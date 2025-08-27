// config.js

class ResponseConfig {
    constructor() {
        // ▼▼▼▼▼ 1. 키워드 구조를 카테고리별 객체로 변경 ▼▼▼▼▼
        this.strictlyIrrelevantKeywords = {
            food: ['점심', '저녁', '아침', '메뉴', '음식', '식사', '맛집', '레시피', '배달'],
            dailyLife: ['날씨', '기온', '미세먼지', '교통', '수학', '계산', '환율'],
            entertainment: ['영화', '드라마', '게임', '노래', '음악', '여행', '연예인', '스포츠'],
            personal: ['너 누구야', '넌 누구니', '이름이 뭐야', '만든사람', '개발자'],
            helpKeywords: ['도움', '도와', '뭐', '무엇', '어떤', '알려', '가능', '할수있'],
            emotion: ['슬픔', '우울', '기쁨', '신남', '화남', '짜증남', '귀찮음', '재수없음', '행복', '흥분']
        };
        
        this.coreKeywords = {
            location: ['위치', '주소', '어디', '강남역', '찾아가', '오시는길', '지점'],
            price: ['가격', '비용', '요금', '얼마', '월세', '임대료'],
            facility: ['시설', '공간', '스튜디오', '회의실', '강당', '헬스장'],
            service: ['서비스', '혜택', '네트워킹', '지원', '커피', '주차'],
            reservation: ['예약', '이용시간', '결제', '방법', '운영시간'],
            contact: ['연락처', '전화', '문의', '고객센터', '상담'],
            general: ['마이워크스페이스', '공유오피스']
        };
        this.greetingKeywords= ['안녕', '하세요', '하이', '헬로', 'hello', 'hi', '반가'],
        
        this.promptTemplates = {
            myworkspace: `[시스템 규칙]
당신은 마이워크스페이스의 친절하고 전문적인 AI 상담원입니다. 당신의 목표는 사람과 대화하듯 자연스럽게 답변하는 것입니다.

[제공된 문서 정보]
{context}

[사용자 질문]
{question}
 
[정보 처리 및 검증 절차 (Chain-of-Thought)]
1. [사용자 질문]의 핵심 의도를 파악합니다.
2. [제공된 문서 정보]가 질문의 핵심 의도에 직접적으로 답변할 수 있는 내용을 포함하는지 **반드시 검증합니다.** - (예: 사용자가 '시설'을 물었다면, 문서에 '스튜디오', '회의실', '헬스장' 등 구체적인 시설 목록이 포함되어 있는지 확인)
3. **검증 결과, 문서가 질문과 직접적인 관련이 있다고 판단될 경우에만** 해당 정보를 바탕으로 친절하고 자연스러운 답변을 생성합니다.
4. **만약 문서가 질문과 관련이 없다면 (예: '시설' 질문에 '주소' 정보만 있는 경우),** 절대 그 내용을 바탕으로 답변을 만들지 말고, 정확히 아래의 fallback 메시지만을 출력해야 합니다.
   > "죄송하지만 문의하신 내용에 대한 정확한 정보를 찾지 못했습니다. 자세한 안내를 위해 02-1234-5678로 연락 주시겠어요?"
5. '[문제 해결]:', '[추가 정보]:' 와 같이 대괄호([])를 사용하여 답변을 항목별로 나누거나 레이블을 붙이지 마세요.
[절대 금지 사항]
- 관련 없는 문서 내용을 짜깁기하여 답변하지 마세요.
- AI이거나 문서를 참조했다는 사실을 절대로 언급하지 마세요.
- '시설'과 관련된 질문에 '공간', '위치'에 대한 내용은 제공하지마세요
답변:`

        };
    }

    analyzeQueryType(query) {
        const queryLower = query.toLowerCase().replace(/\s+/g, '');

        if (this.greetingKeywords.some(k => queryLower.includes(k) && query.length < 10)) {
            return { type: 'greeting' };
        }
        
        // ▼▼▼▼▼ 2. 카테고리화된 객체를 처리하도록 로직 수정 ▼▼▼▼▼
        const allIrrelevantKeywords = Object.values(this.strictlyIrrelevantKeywords).flat();
        if (allIrrelevantKeywords.some(keyword => queryLower.includes(keyword))) {
            return { type: 'strictly_irrelevant' };
        }
        
        const allCoreKeywords = Object.values(this.coreKeywords).flat();
        if (allCoreKeywords.some(keyword => queryLower.includes(keyword))) {
            return { type: 'specific_question' };
        }

        if (this.helpKeywords.some(keyword => queryLower.includes(keyword))) {
            return { type: 'help' };
        }
        
        return { type: 'general_question' };
    }
}

const responseConfig = new ResponseConfig();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { responseConfig };
}