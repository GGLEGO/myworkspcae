// chat.js
// demo.html의 프론트엔드 로직을 담당하는 파일
let isProcessing = false;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 마이워크스페이스 채팅 데모 시스템 로드됨');
    initializeDemoPage();
    
    // 입력창에 자동으로 포커스(챗봇 아이콘 클릭시, 입력창 클릭하지 않아도 바로 입력 가능)
    const input = document.getElementById('userInput');
    if (input) {
        input.focus();
    }
});

// 데모 페이지 초기화
function initializeDemoPage() {
    console.log('🎯 데모 페이지 초기화');
    // 서버 상태를 확인하여 화면에 표시
    checkServerStatus();
}

// 메시지를 채팅창에 추가하는 함수
function addMessage(type, content) {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return null;

    const welcomeMessage = messagesDiv.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    // 'bot loading' 처럼 두 단어 클래스도 정상적으로 추가됩니다.
    messageDiv.className = 'message ' + type;

    // 'loading' 클래스가 포함되어 있으면 content를 HTML로 바로 삽입
    if (type.includes('loading')) {
        messageDiv.innerHTML = content;
    } else {
        // 아닐 경우에만 줄바꿈(\n) 문자를 <br> 태그로 변경
        messageDiv.innerHTML = content.replace(/\n/g, '<br>');
    }

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return messageDiv;
}

// 메시지 전송 함수 (비동기 처리)
async function sendMessage() {
    if (isProcessing) return;
    
    const input = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    
    if (!input || !sendButton) return;
    
    const question = input.value.trim();
    if (!question) return;
    
    isProcessing = true;
    sendButton.disabled = true;
    input.disabled = true;
    
    // 1. 사용자가 입력한 메시지를 화면에 표시
    addMessage('user', question);
    input.value = '';
    
    const loadingHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    // 2. "답변 생성 중..." 로딩 메시지 표시
    const loadingMessage = addMessage('bot loading', loadingHTML);
    
    try {
        // 3. 서버의 /chat API로 질문 전송
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                question: question,
                sessionId: 'demo-session' 
            }),
        });
        
        if (!response.ok) {
    throw new Error('서버 응답 오류: ' + response.status);
}

const data = await response.json();

// 4. 로딩 메시지를 실제 답변으로 교체 (줄바꿈 처리)
if (loadingMessage) {
    loadingMessage.innerHTML = data.answer.replace(/\n/g, '<br>');
}
    } catch (error) {
        console.error('채팅 오류:', error);
        if (loadingMessage) {

            // 오류 발생(docker의 chromadb의 서버가 꺼지는 경우)시 로딩 메시지를 오류 텍스트로 교체
            loadingMessage.innerHTML = '죄송합니다. 오류가 발생했습니다.';
            loadingMessage.classList.remove('loading'); // 로딩 스타일 제거
        }
    } finally {
        // 5. 입력창 다시 활성화
        isProcessing = false;
        sendButton.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

// 빠른 질문(위치, 가격, 시설) 버튼 클릭 시 메시지 전송
function sendQuickMessage(message) {
    const input = document.getElementById('userInput');
    if (input) {
        input.value = message;
        sendMessage();
    }
}

// 서버 상태 확인 함수
async function checkServerStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const testResult = document.getElementById('testResult');
    
    if (!statusDot || !statusText || !testResult) return;
    
    statusText.textContent = '서버 상태 확인 중...';
    statusDot.className = 'status-dot'; // 기본 노란색
    
    try {
        const response = await fetch('http://localhost:3000/status');
        
        if (response.ok) {
            const data = await response.json();
            
            // 서버 응답의 components.llm과 vectorStore가 모두 true인지 확인
            if (data.components && data.components.llm && data.components.vectorStore) {
                statusDot.className = 'status-dot online'; // 초록색
                statusText.textContent = '🟢 서버 온라인 - AI 시스템 준비됨';
                testResult.style.display = 'block';
                testResult.className = 'test-result success';
                testResult.textContent = `✅ 서버 연결 성공! (문서 ${data.data.documentsCount}개 로드됨)`;
            } else {
                throw new Error('AI 컴포넌트 준비 안됨');
            }
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        statusDot.className = 'status-dot offline'; // 빨간색
        statusText.textContent = '🔴 서버 오프라인';
        testResult.style.display = 'block';
        testResult.className = 'test-result error';
        testResult.textContent = `❌ 서버 연결 실패: ${error.message}`;
    }
}

// 채팅 API 테스트 함수
async function testChatAPI() {
    const testResult = document.getElementById('testResult');
    if (!testResult) return;
    
    testResult.style.display = 'block';
    testResult.className = 'test-result';
    testResult.textContent = '🧪 채팅 API 테스트 중...';
    
    try {
        const response = await fetch('http://localhost:3000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: 'API 테스트' })
        });
        
        if (response.ok) {
            const data = await response.json();
            testResult.className = 'test-result success';
            testResult.textContent = `✅ 채팅 API 테스트 성공!\n응답: "${data.answer.substring(0, 50)}..."`;
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        testResult.className = 'test-result error';
        testResult.textContent = `❌ 채팅 API 테스트 실패: ${error.message}`;
    }
}
