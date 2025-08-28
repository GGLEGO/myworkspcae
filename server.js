const express = require('express');
const cors = require('cors');
const path = require('path');
const { WorkspaceChatbot } = require('./workspace-chatbot');
const chokidar = require('chokidar');

class ChatbotServer {
    constructor(port = 3000) {
        this.app = express();
        this.port = port;
        this.chatbot = null;
        this.ragInitialized = false;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    // 미들웨어 설정
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        // 정적 파일 제공 (demo.html, chat.js, style.css 등)
        this.app.use(express.static(path.join(__dirname)));
    }
    
    // 라우트 설정
    setupRoutes() {
        this.app.get('/', (req, res) => res.redirect('/demo')); // 루트 접속 시 데모 페이지로 이동
        this.app.get('/demo', (req, res) => res.sendFile(path.join(__dirname, 'demo.html')));
        
        this.app.get('/chatbot-widget.js', (req, res) => res.sendFile(path.join(__dirname, 'chatbot-widget.js')));
        
        this.app.post('/chat', async (req, res) => await this.handleChat(req, res));
        this.app.get('/status', (req, res) => this.handleStatus(req, res));
    }

    // 채팅 요청 핸들러
    async handleChat(req, res) {
        try {
            const { question } = req.body;
            if (!question) {
                return res.status(400).json({ answer: '질문을 입력해주세요.', error: true });
            }

            const docs = await this.chatbot.searchSimilarDocuments(question, 2);
            const response = await this.chatbot.generateResponse(question);
            
            // ChromaDB에서 반환된 메타데이터 경로 수정
            const sources = docs.map(doc => ({
                category: doc.document.metadata.category || '문서',
                source: doc.document.metadata.source || 'unknown',
                title: doc.document.metadata.title || '제목 없음'
            }));

            res.json({ answer: response, sources });

        } catch (error) {
            console.error('❌ 채팅 처리 오류:', error);
            res.status(500).json({ answer: "죄송합니다. 서버 내부 오류가 발생했습니다.", error: true });
        }
    }
    
    // 상태 확인 핸들러
    handleStatus(req, res) {
        res.header('Access-Control-Allow-Origin', '*');
        const statusData = {
            status: this.ragInitialized ? 'online' : 'initializing',
            components: {
                llm: this.ragInitialized,
                // chatbot.documentsCount > 0 으로 벡터 저장소 상태 확인()
                vectorStore: this.ragInitialized && (this.chatbot.documentsCount > 0)
            },
            data: { 
                // documentsCount를 사용하여 로드된 청크 수 표시
                documentsCount: this.chatbot.documentsCount || 0 
            }
        };
        res.json(statusData);
    }
    
    // 서버 시작 메서드
    async start() {
        console.log('🚀 ChromaDB 연동 AI 상담 시스템 시작...');
        try {
            this.chatbot = new WorkspaceChatbot(); 
            
            // 핵심: 서버 시작 시 챗봇 초기화 및 사전 벡터화 실행
            await this.chatbot.initialize();
            this.ragInitialized = true;
            
            this.app.listen(this.port, () => {
                console.log(`\n🎉 서버 시작 완료! 데모 페이지: http://localhost:${this.port}/demo`);
                
                //서버가 성공적으로 시작된 후 파일 감시 시작
                this.watchDocumentChanges(); 
            });

        } catch (error) {
            console.error('❌ 서버 시작 실패:', error);
            this.ragInitialized = false;
        }
    }
    
    watchDocumentChanges() {
        const filePath = path.join(__dirname, 'documents.json');
        console.log(`\n👀 이제 '${filePath}' 파일의 변경을 실시간으로 감시합니다...`);

        const watcher = chokidar.watch(filePath, {
            persistent: true,
            ignoreInitial: true, // 처음 실행 시에는 이벤트 발생 안 함
        });

        // 파일 내용이 변경(저장)될 때 이벤트 처리
        watcher.on('change', async (path) => {
            // chatbot 객체가 존재할 때만 재인덱싱 함수 호출
            if (this.chatbot) {
                await this.chatbot.reindexDocuments();
            }
        });
    }
}


if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    const server = new ChatbotServer(PORT);
    server.start();
}

module.exports = ChatbotServer;
