// workspace-chatbot.js

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { responseConfig } = require('./config');
const { ChromaClient } = require('chromadb');


// --- 1. ChromaDB 벡터 저장소 클래스---
class ChromaVectorStore {
    constructor(url = 'http://localhost:8000') {
        this.client = new ChromaClient({ path: url });
        this.collection = null;
        this.collectionName = 'myworkspace-collection';
    }

    async initialize() {
        try {
            this.collection = await this.client.getOrCreateCollection({
                name: this.collectionName,
                metadata: { "hnsw:space": "cosine" },
            });
            console.log(`✅ ChromaDB 컬렉션 "${this.collectionName}" 준비 완료`);
            return await this.collection.count();
        } catch (error) {
            console.error('❌ ChromaDB 컬렉션 초기화 실패:', error);
            throw error;
        }
    }
    
    async deleteCollection() {
        try {
            await this.client.deleteCollection({ name: this.collectionName });
            console.log(`🗑️ 기존 ChromaDB 컬렉션 "${this.collectionName}" 삭제 완료`);
        } catch (error) {
            if (error.message.includes("does not exist")) {
                console.log(`ℹ️ 삭제할 기존 컬렉션이 없어 건너뜁니다.`);
            } else {
                console.error('❌ ChromaDB 컬렉션 삭제 실패:', error);
                throw error;
            }
        }
    }

    async addDocuments(chunks, embeddings) {
        if (!this.collection) throw new Error("ChromaDB 컬렉션이 초기화되지 않았습니다.");
        
        const ids = chunks.map((_, index) => `doc_chunk_${Date.now()}_${index}`);
        const documents = chunks.map(chunk => chunk.content);
        const metadatas = chunks.map(chunk => ({ 
            original_metadata: JSON.stringify(chunk.metadata) 
        }));

        await this.collection.add({ ids, embeddings, metadatas, documents });
    }

    async similaritySearch(queryEmbedding, topK = 3) {
        if (!this.collection) throw new Error("ChromaDB 컬렉션이 초기화되지 않았습니다.");
        
        const results = await this.collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: topK,
        });

        if (!results || !results.ids || results.ids.length === 0 || results.ids[0].length === 0) return [];
        
        return results.ids[0].map((id, index) => {
            const metadata = JSON.parse(results.metadatas[0][index].original_metadata);
            return {
                document: {
                    content: results.documents[0][index],
                    metadata: metadata,
                },
                similarity: 1 - results.distances[0][index],
            }
        });
    }
}


// --- 2. 메인 챗봇 클래스 ---
class WorkspaceChatbot {
    constructor() {
        this.vectorStore = new ChromaVectorStore(); 
        this.ollamaUrl = 'http://localhost:11434';
        this.embeddingModel = 'nomic-embed-text';
        this.llmModel = 'gemma2:2b';
        this.responseConfig = responseConfig;
        this.documentsCount = 0; 
    }

    async initialize() {
        try {
            console.log('🚀 ChromaDB 기반 RAG 시스템 초기화 중...');
            const existingItemCount = await this.vectorStore.initialize();

            if (existingItemCount === 0) {
                console.log('📦 ChromaDB 컬렉션이 비어있어 새로 데이터를 임베딩합니다.');
                const docsPath = path.join(__dirname, 'documents.json');
                const fileContent = await fs.readFile(docsPath, 'utf-8');
                const documents = JSON.parse(fileContent).documents;

                if (!documents || documents.length === 0) {
                    console.error('❌ documents.json 파일에 문서가 없습니다.');
                    return;
                }
                
                await this.embedAndStoreDocuments(documents);
            } else {
                console.log(`👍 ChromaDB에 이미 ${existingItemCount}개의 데이터가 존재합니다. 임베딩을 건너뜁니다.`);
                this.documentsCount = await this.vectorStore.collection.count();
            }
            
            console.log('✅ 시스템 초기화 완료');
        } catch (error) {
            console.error('❌ 초기화 실패:', error); 
            throw error;
        }
    }

    async reindexDocuments() {
        try {
            console.log('\n🔄 [실시간 업데이트] documents.json 파일 변경 감지. 재인덱싱을 시작합니다...');
            await this.vectorStore.deleteCollection();
            await this.vectorStore.initialize();
            const docsPath = path.join(__dirname, 'documents.json');
            const fileContent = await fs.readFile(docsPath, 'utf-8');
            const documents = JSON.parse(fileContent).documents;

            if (!documents || documents.length === 0) {
                console.error('❌ [실시간 업데이트] 파일에 문서가 없어 중단합니다.');
                return;
            }
            
            await this.embedAndStoreDocuments(documents);
            console.log('✅ [실시간 업데이트] 재인덱싱 완료!');
        } catch (error) {
            console.error('❌ [실시간 업데이트] 재인덱싱 중 오류 발생:', error);
        }
    }
    
    async embedAndStoreDocuments(documents) {
        const chunksToEmbed = [];
        const embeddingsToStore = [];

        console.log(`📄 ${documents.length}개의 문서를 임베딩합니다...`);
        for (const doc of documents) {
            const chunks = this.splitIntoChunks(doc.content, 500);
            for (const chunk of chunks) {
                const chunkWithMetadata = { content: chunk, metadata: doc };
                chunksToEmbed.push(chunkWithMetadata);
                const embedding = await this.getEmbedding(chunk);
                embeddingsToStore.push(embedding);
            }
        }
        
        await this.vectorStore.addDocuments(chunksToEmbed, embeddingsToStore);
        this.documentsCount = chunksToEmbed.length;
        console.log(`📚 ${this.documentsCount}개 문서 청크 임베딩 및 ChromaDB 저장 완료`);
    }
    async classifyQueryWithLLM(userQuestion) {
        // LLM에게 역할을 부여하고, 선택지를 명확하게 제시하는 프롬프트
        const classificationPrompt = `
[시스템 지침]
당신은 사용자의 질문을 분석하여 가장 적절한 카테리로 분류하는 AI 분류기입니다.
당신의 임무는 아래에 정의된 카테고리 중 **하나만** 골라 답변하는 것입니다. 다른 설명은 절대 추가하지 마세요.

[카테고리 정의]
- GREETING: 간단한 인사말 (안녕, 하이 등)
- LOCATION: 위치, 주소, 지점, 찾아가는 길 관련 질문
- PRICE: 가격, 요금, 비용, 월세 관련 질문
- FACILITY: 시설, 회의실, 스튜디오, 헬스장 등 공간 관련 질문
- SERVICE: 제공하는 서비스, 혜택, 네트워킹, 지원 프로그램 관련 질문
- RESERVATION: 예약, 이용 시간, 결제 방법 관련 질문
- CONTACT: 연락처, 전화번호, 문의 방법 관련 질문
- COMPANY_INFO: 마이워크스페이스라는 회사 자체에 대한 질문
- OFF_TOPIC: 위 카테고리에 모두 해당하지 않는, 공유오피스와 관련 없는 모든 질문 (예: 날씨, 음식, 스포츠, 잡담 등)

[사용자 질문]
"${userQuestion}"

[분류 결과]
카테고리:`;

        console.log(`🧠 LLM에게 의도 분류 요청: "${userQuestion}"`);
        
        try {
            // queryLlama와 유사하지만, 더 빠르고 간단한 모델을 사용하거나 동일 모델을 사용
            const response = await this.queryLlama(classificationPrompt);
            
            // LLM 응답에서 카테고리 이름만 깔끔하게 추출
            const category = response.replace('카테고리:', '').trim().toUpperCase();
            console.log(`🤖 LLM 분류 결과: ${category}`);
            return category;

        } catch (error) {
            console.error('❌ 의도 분류 중 LLM 오류 발생:', error);
            // 오류 발생 시 안전하게 'OFF_TOPIC'으로 처리
            return 'OFF_TOPIC';
        }
    }
    
    async generateResponse(userQuestion) {
        try {
            console.log(`\n💬 사용자 질문: "${userQuestion}"`);
            
            // 1. 키워드 기반 분석 대신 LLM 기반 의도 분류 실행
            const intent = await this.classifyQueryWithLLM(userQuestion);

            // 2. 분류된 의도(intent)에 따라 행동을 결정하는 switch 문
            switch (intent) {
                case 'LOCATION':
                case 'PRICE':
                case 'FACILITY':
                case 'SERVICE':
                case 'RESERVATION':
                case 'CONTACT':
                case 'COMPANY_INFO':
                    // 비즈니스 관련 질문일 경우에만 RAG 프로세스 실행
                    console.log(`✅ 비즈니스 질문(${intent})으로 판단하여 RAG 답변을 생성합니다.`);
                    const similarChunks = await this.searchSimilarDocuments(userQuestion, 5);
                    const relevantContext = similarChunks
                        .filter(chunk => chunk.similarity >= 0.4)
                        .map(item => item.document.content)
                        .join('\n\n---\n\n');
                    
                    const prompt = this.buildPrompt(userQuestion, relevantContext);
                    const response = await this.queryLlama(prompt);
                    return this.cleanResponse(response);

                case 'GREETING':
                    return "안녕하세요! 마이워크스페이스 AI 상담원입니다. 무엇을 도와드릴까요?";

                case 'OFF_TOPIC':
                default:
                    // 관련 없는 질문이거나 분류에 실패한 경우
                    console.log('❌ 관련 없는 질문으로 판단하여 기본 응답을 반환합니다.');
                    return "죄송하지만 문의하신 내용에 대해서는 답변해 드릴 수 없습니다. 공유오피스 관련 질문을 해주세요.";
            }
        } catch (error) {
            console.error('❌ AI 응답 생성 실패:', error);
            return `죄송합니다, 일시적인 시스템 오류가 발생했습니다.`;
        }
    }
    
    buildPrompt(userQuestion, context) {
        let template;
        if (!context || context.trim().length === 0) {
            console.log("⚠️  컨텍스트가 비어 있어 Fallback 프롬프트를 사용합니다.");
            template = this.responseConfig.promptTemplates.noContextFallback;
        } else {
            template = this.responseConfig.promptTemplates.myworkspace;
        }
    
        return template.replace('{context}', context).replace('{question}', userQuestion);
    }
    
    async searchSimilarDocuments(query, topK = 3) {
        const queryEmbedding = await this.getEmbedding(query);
        return await this.vectorStore.similaritySearch(queryEmbedding, topK);
    }

    async queryLlama(prompt) {
        const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
            model: this.llmModel,
            prompt,
            options: { temperature: 0.1, top_p: 0.8 },
            stream: false
        });
        return response.data.response.trim();
    }

    cleanResponse(response) {
        let cleaned = response.replace(/^.*(안내|알려|말씀)드리겠습니다\.?\s*/i, '').trim();
        cleaned = cleaned.replace(/\*{1,2}/g, ''); 
        return cleaned;
    }

    async getEmbedding(text) {
        try {
            const response = await axios.post(`${this.ollamaUrl}/api/embeddings`, {
                model: this.embeddingModel, prompt: text
            });
            if (!response.data || !response.data.embedding) {
                throw new Error('Ollama에서 유효한 임베딩을 받지 못했습니다.');
            }
            return response.data.embedding;
        } catch (error) {
            console.error(`'${text.substring(0, 30)}...' 텍스트 임베딩 생성 실패:`, error.message);
            throw error;
        }
    }

    splitIntoChunks(text, chunkSize) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.substring(i, i + chunkSize));
        }
        return chunks;
    }
}

module.exports = { WorkspaceChatbot };