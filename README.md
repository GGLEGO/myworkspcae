# Myworkspace chatbot

## Langchain이란
질문 -> 문서 검색 -> 검색된 문서와 질문을 LLM에 전달 -> 답변 생성

chatbot에서 수정
질문 -> llm을 사용해 1차 단어 필터링 -> 문서 검색 -> 검색된 문서와 질문을 2차로 필터링 LLM에 전달(**RAG***과정) -> 답변 생성

Langchain과 동일한 로직(workspace-chatbot.js)
ChromaVectorStore 클래스를 직접 만들어 ChromaDB에 접속하고, similaritySearch 함수로 유사 문서를 검색, 문서의 내용을 바탕으로 답변 생성

---------------------------------

## 서버 실행 방법
ollama, docker 프로그램 다운로드(docker 프로그램에서 ollama의 llm일부 다운로드 가능, 테스트 해봐야함)
npm install express axios @chroma/chroma uuid

### CMD순서
1. docker run -p 8000:8000 chromadb/chroma
2. [파일이 있는 폴더]\node server.js


------------------------------------

- 서버 로그 확인
1차 필터링
workspace-chatbot.js에서 llm을 통해 카테고리를 선정하여 단어를 먼저 분류함
단어가 존재하는 경우 (문서의 키워드)를 결과를 알려줌
관계 없는 내용: OFF_TOPIC

2차 필터링
-> config.js의 this.strictlyIrrelevantKeywords에서 답변을 못하는 키워드 정의
및 챗봇이 llm을 통해 자연스러운 대답을 할 수 있도록 프롬포트 입력

------------------------------------------

**기능**
> **Docker**: 챗봇 시스템의 '독립된 실행 환경'을 제공. 챗봇의 핵심 부품인 ChromaDB와 Ollama(AI 모델 실행기) 를 내 컴퓨터에 직접 설치할 필요 없이, Docker 컨테이너라는 격리된 공간에서 간편하게 실행시켜 줌.
> **ChromaDB**: 'AI를 위한 초고속 도서관 색인' 역할을 하는 벡터 데이터베이스. `documents.json`의 텍스트 내용을 그냥 저장하는 것이 아니라, `nomic-embed-text`가 변환한 숫자 벡터(의미 좌표)로 저장. 덕분에 키워드 검색을 넘어 "이용료가 궁금해요"처럼 의미가 비슷한 질문도 정확하게 찾아낼 수 있음.
> **nomic-embed-text**: '텍스트를 숫자로 번역하는 번역가' . 텍스트 임베딩 모델로서, `documents.json`의 문장들과 사용자 질문을 ChromaDB가 이해할 수 있는 숫자 벡터(Embedding)로 변환하는 역할을 전담.
> **gemma2:2b**: '문맥을 이해하고 답변을 생성하는 AI 두뇌' . ChromaDB가 찾아준 관련성 높은 문서 내용(Context)과 사용자 질문을 함께 받고, 이 정보를 조합하여 가장 적절하고 자연스러운 답변 문장을 생성하는 데 집중.


**파일 역할**
> `documents.json` - 문서

> `config.js` - 규칙 설정

> `workspace-chatbot.js` - rag시스템 메인 엔진(gemma2:2b 및 nomic-embed-text)

> `server.js` - 외부(웹 브라우저)의 요청을 받아 `workspace-chatbot.js`에 전달하고, 그 결과를 다시 외부에 보내주는 '중간 다리' 역할
> `chatbot-widget.js` & `demo.html` & `style.css` - 프론트엔드(UI)

**과정**
`1`
server.js → chatbot.initialize() 호출: 서버가 시작되면 WorkspaceChatbot의 initialize 함수를 실행

initialize() → embedAndStoreDocuments() 호출: initialize 함수는 ChromaDB가 비어있는 것을 확인하고, documents.json 파일을 읽어 embedAndStoreDocuments 함수를 호출

embedAndStoreDocuments():

    documents.json의 각 문서를 500자 단위의 작은 조각(chunk)으로 분할

    getEmbedding()함수를 호출하여 각 조각을 숫자 벡터로 변환

    vectorStore.addDocuments()를 통해 변환된 벡터와 원본 텍스트 조각을 ChromaDB에 저장

`2-1`
server.js → chatbot.generateResponse() 호출: 사용자의 채팅 요청이 들어오면 generateResponse 함수가 호출

generateResponse() → classifyQueryWithLLM() 호출:  답변을 생성하기 전에, LLM을 사용해 사용자의 질문 의도를 파악하는 classifyQueryWithLLM 함수를 호출

classifyQueryWithLLM():LLM에게 "분류기" 역할을 하도록 지시하는 의도 분류용 프롬프트


`2-2`
generateResponse()로 복귀:

    classifyQueryWithLLM이 반환한 카테리가 'OFF_TOPIC'이나 'GREETING'이 아닌 경우에만 다음 RAG(검색 증강 생성) 단계를 진행

searchSimilarDocuments() 호출: 비즈니스 관련 질문으로 판단되면, 이 질문과 가장 관련 있는 문서 조각을 찾기 위해 searchSimilarDocuments 함수를 호출

    getEmbedding(query): 사용자의 질문(query)을 실시간으로 벡터로 변환

    vectorStore.similaritySearch(): 변환된 질문 벡터를 이용해 ChromaDB에서 코사인 유사도가 가장 높은 문서 벡터들을 검색

답변 생성:

    searchSimilarDocuments가 찾아온 유사도 높은 문서 조각들을 relevantContext라는 "참고 자료"로 합칩

    buildPrompt() 함수가 이 참고 자료(context)와 사용자 질문(question)을 config.js의 답변 생성용 프롬프트와 조합하여 LLM에게 보낼 최종 프롬프트

    queryLlama() 함수가 이 최종 프롬프트를 LLM에게 전달하고, LLM은 "친절한 AI 상담원"의 역할에 맞춰 참고 자료에 근거한 최종 답변을 생성


**기타**
평균 1분 30초 내로 답변(컴퓨터의 성능에 따라 다를 수도 있음)
workspace-chatbot.js의 
const { ChromaClient } = require('chromadb');에서 'chromadb를 클릭할 시,
import * as openai from 'openai';
import * as _google_generative_ai from '@google/generative-ai'; 
가 있지만 
openai, @google/generative-ai는 import할 때는 비용발생X
