(function() {
    // 위젯 초기화 함수
    function initWidget() {
        
        // 설정값 가져오기 (HTML 태그의 data-* 속성)
        const chatbotElement = document.getElementById('workspace-chatbot');
        if (!chatbotElement) {
            console.error('AI 챗봇을 표시할 <div id="workspace-chatbot"></div> 요소를 찾을 수 없습니다.');
            return;
        }
        const serverUrl = chatbotElement.dataset.server || 'http://localhost:3000';
        const position = chatbotElement.dataset.position || 'bottom-right';

        // 위젯에 필요한 CSS 스타일을 동적으로 주입
        injectCSS();

        // 위젯 HTML 구조 생성 및 삽입
        const widgetHTML = createWidgetHTML(position);
        chatbotElement.innerHTML = widgetHTML;

        // 위젯 동작에 필요한 이벤트 리스너 설정
        setupEventListeners(serverUrl);
    }

    // 위젯 HTML 구조를 생성하는 함수
    function createWidgetHTML(position) {
        return `
            <div class="myworkspace-chatbot-widget ${position}">
                <div class="myworkspace-chat-window">
                    <div class="myworkspace-widget-header">
                        <h3>AI 상담 챗봇</h3>
                        <button class="myworkspace-widget-close">&times;</button>
                    </div>
                    <div class="myworkspace-widget-messages">
                        <div class="myworkspace-widget-message bot">안녕하세요! 무엇을 도와드릴까요?</div>
                    </div>
                    <div class="myworkspace-quick-suggestions">
                        <p>자주 묻는 질문:</p>
                        <div class="myworkspace-suggestion-buttons">
                            <button class="myworkspace-suggestion-btn">위치</button>
                            <button class="myworkspace-suggestion-btn">가격</button>
                            <button class="myworkspace-suggestion-btn">시설</button>
                        </div>
                    </div>
                    <div class="myworkspace-widget-input">
                        <input type="text" placeholder="메시지를 입력하세요...">
                        <button class="myworkspace-widget-send">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
                <button class="myworkspace-chat-toggle">
                    <i class="fas fa-comments"></i>
                </button>
            </div>
        `;
    }

    // 이벤트 리스너를 설정하는 함수
    function setupEventListeners(serverUrl) {
        const toggleButton = document.querySelector('.myworkspace-chat-toggle');
        const closeButton = document.querySelector('.myworkspace-widget-close');
        const chatWindow = document.querySelector('.myworkspace-chat-window');
        const input = document.querySelector('.myworkspace-widget-input input');
        const sendButton = document.querySelector('.myworkspace-widget-send');
        const suggestionButtons = document.querySelectorAll('.myworkspace-suggestion-btn');

        // 토글 버튼 클릭 시 채팅창 열고 닫기
        toggleButton.addEventListener('click', () => {
            chatWindow.classList.toggle('open');
            if (chatWindow.classList.contains('open')) {
                input.focus();
            }
        });

        // 닫기 버튼 클릭 시 채팅창 닫기
        closeButton.addEventListener('click', () => {
            chatWindow.classList.remove('open');
        });
        
        // 엔터 키 입력 시 메시지 전송
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage(serverUrl);
            }
        });
        
        // 전송 버튼(종이비행기 아이콘) 클릭 시 메시지 전송
        sendButton.addEventListener('click', () => sendMessage(serverUrl));
        
        //자주 묻는 질문 버튼 클릭 시 메시지 전송
        suggestionButtons.forEach(button => {
            button.addEventListener('click', () => {
                const questionMap = {
                    '위치': '위치가 어떻게 되나요?',
                    '가격': '가격 정보를 알려주세요',
                    '시설': '시설은 어떤 것들이 있나요?'
                };
                input.value = questionMap[button.textContent] || button.textContent;
                sendMessage(serverUrl);
            });
        });
    }

    let isProcessing = false;

    // 메시지 전송 로직
    async function sendMessage(serverUrl) {
        if (isProcessing) return;

        const input = document.querySelector('.myworkspace-widget-input input');
        const question = input.value.trim();
        if (!question) return;

        isProcessing = true;
        input.disabled = true;

        addMessage('user', question);
        input.value = '';

        const loadingMessage = addMessage('bot', `
            <div class="myworkspace-typing-dots">
                <div class="myworkspace-typing-dot"></div>
                <div class="myworkspace-typing-dot"></div>
                <div class="myworkspace-typing-dot"></div>
            </div>
        `, true);

        try {
            const response = await fetch(`${serverUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            updateMessage(loadingMessage, data.answer);

        } catch (error) {
            console.error('Chat API Error:', error);
            updateMessage(loadingMessage, '오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            isProcessing = false;
            input.disabled = false;
            input.focus();
        }
    }

    // 채팅창에 메시지를 추가하는 함수
    function addMessage(type, content, isHtml = false) {
        const messagesContainer = document.querySelector('.myworkspace-widget-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `myworkspace-widget-message ${type}`;
        
        if (isHtml) {
            messageDiv.innerHTML = content;
        } else {
            // \n을 <br>로 변환하여 줄바꿈 처리
            messageDiv.innerHTML = content.replace(/\n/g, '<br>');
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return messageDiv;
    }

    // 로딩 메시지를 실제 답변으로 업데이트하는 함수
    function updateMessage(messageElement, newContent) {
        if (messageElement) {
            messageElement.innerHTML = newContent.replace(/\n/g, '<br>');
        }
    }

    // CSS를 동적으로 head에 주입하는 함수
    function injectCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Font Awesome 아이콘 CDN (위젯이 독립적으로 작동하도록) */
            @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');

            /* 위젯 컨테이너 */
            .myworkspace-chatbot-widget {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 2147483647;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            .myworkspace-chatbot-widget.bottom-left { bottom: 20px; left: 20px; right: auto; }
            .myworkspace-chatbot-widget.top-right { top: 20px; bottom: auto; right: 20px; }
            .myworkspace-chatbot-widget.top-left { top: 20px; bottom: auto; left: 20px; right: auto; }

            /* 토글 버튼 */
            .myworkspace-chat-toggle {
                width: 60px; height: 60px; border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; border: none; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                font-size: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                transition: all 0.3s ease;
                animation: myworkspace-pulse 2s infinite;
            }
            .myworkspace-chat-toggle:hover { transform: scale(1.1); }
            @keyframes myworkspace-pulse {
                0% { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4); }
                50% { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.8); }
                100% { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4); }
            }

            /* 채팅 창 */
            .myworkspace-chat-window {
                position: absolute; bottom: 80px; right: 0;
                width: 350px; height: 500px; background: white;
                border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                display: none; flex-direction: column; overflow: hidden;
                animation: myworkspace-slideUp 0.3s ease-out;
            }
            .myworkspace-chatbot-widget.bottom-left .myworkspace-chat-window { right: auto; left: 0; }
            .myworkspace-chatbot-widget.top-right .myworkspace-chat-window, .myworkspace-chatbot-widget.top-left .myworkspace-chat-window { bottom: auto; top: 80px; }
            .myworkspace-chat-window.open { display: flex; }
            @keyframes myworkspace-slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }

            /* 위젯 헤더 */
            .myworkspace-widget-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; padding: 15px 20px;
                display: flex; align-items: center; justify-content: space-between;
            }
            .myworkspace-widget-header h3 { margin: 0; font-size: 16px; }
            .myworkspace-widget-close { background: none; border: none; color: white; font-size: 20px; cursor: pointer; }

            /* 메시지 영역 */
            .myworkspace-widget-messages {
                flex: 1; overflow-y: auto; padding: 15px;
                display: flex; flex-direction: column; gap: 12px;
            }
            .myworkspace-widget-message {
                max-width: 80%; padding: 10px 14px; border-radius: 12px;
                font-size: 14px; line-height: 1.4;
            }
            .myworkspace-widget-message.user {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; align-self: flex-end; border-bottom-right-radius: 4px;
            }
            .myworkspace-widget-message.bot {
                background: #f8f9fa; color: #333; align-self: flex-start;
                border: 1px solid #e9ecef; border-bottom-left-radius: 4px;
            }

            /* 입력 영역 */
            .myworkspace-widget-input {
                padding: 15px; border-top: 1px solid #e9ecef;
                display: flex; gap: 10px; align-items: center;
            }
            .myworkspace-widget-input input {
                flex: 1; padding: 10px 12px; border: 1px solid #e9ecef;
                border-radius: 20px; outline: none; font-size: 14px;
            }
            .myworkspace-widget-input input:focus { border-color: #667eea; }
            .myworkspace-widget-send {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; border: none; border-radius: 50%;
                width: 35px; height: 35px; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: transform 0.2s ease; font-size: 16px;
            }
            .myworkspace-widget-send:hover { transform: scale(1.1); }
            
            /* 빠른 질문 */
            .myworkspace-quick-suggestions {
                padding: 10px 15px; background: #f8f9fa; border-top: 1px solid #e9ecef;
            }
            .myworkspace-quick-suggestions p { margin: 0 0 8px 0; font-size: 12px; color: #666; }
            .myworkspace-suggestion-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
            .myworkspace-suggestion-btn {
                background: white; border: 1px solid #e9ecef; border-radius: 15px;
                padding: 6px 12px; font-size: 12px; cursor: pointer; transition: all 0.2s ease;
            }
            .myworkspace-suggestion-btn:hover { background: #667eea; color: white; border-color: #667eea; }

            /* 타이핑 애니메이션 */
            .myworkspace-typing-dots { display: flex; gap: 4px; align-items: center; padding: 5px 0; }
            .myworkspace-typing-dot {
                width: 8px; height: 8px; background: #aab5c2;
                border-radius: 50%;
                animation: myworkspace-typingBounce 1.4s infinite ease-in-out both;
            }
            .myworkspace-typing-dot:nth-child(1) { animation-delay: -0.32s; }
            .myworkspace-typing-dot:nth-child(2) { animation-delay: -0.16s; }
            @keyframes myworkspace-typingBounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1.0); }
            }
        `;
        document.head.appendChild(style);
    }

    // Document Object Model이 완전히 로드된 후 위젯 초기화 실행
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidget);
    } else {
        initWidget();
    }
})();
