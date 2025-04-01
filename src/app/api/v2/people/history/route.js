export async function GET(request) {
  // 요청에서 authorization 헤더 가져오기
  const authHeader = request.headers.get("authorization");

  // authorization 헤더 검증
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "인증이 필요합니다.",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // 토큰 추출
  const token = authHeader.split(" ")[1];

  // 토큰 기본 검증
  if (!token || token.length < 10) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "유효하지 않은 토큰입니다.",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // URL 쿼리 파라미터에서 cursor 가져오기
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");

  // 모든 페이지의 데이터를 저장할 배열 초기화
  let allHistoryData = [];
  let nextCursor = cursor || null;
  let hasMorePages = true;

  // 모든 페이지 데이터 가져오기
  // API 요청 제한(12초당 100회)에 맞추기 위한 변수
  let requestCount = 0;
  const MAX_REQUESTS_PER_WINDOW = 100;
  const RATE_LIMIT_WINDOW = 12000; // 12초(밀리초 단위)
  let windowStartTime = Date.now();

  while (hasMorePages) {
    // 현재 시간 창에서 요청 수 확인 및 필요시 대기
    const currentTime = Date.now();
    const timeElapsed = currentTime - windowStartTime;
    
    // 12초가 지났으면 요청 카운터와 시간 창 리셋
    if (timeElapsed >= RATE_LIMIT_WINDOW) {
      requestCount = 0;
      windowStartTime = currentTime;
    }
    
    // 현재 시간 창에서 최대 요청 수에 도달했다면 대기
    if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
      const waitTime = RATE_LIMIT_WINDOW - timeElapsed;
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      // 새 시간 창 시작
      requestCount = 0;
      windowStartTime = Date.now();
    }
    
    // 현재 cursor에 해당하는 데이터 가져오기
    requestCount++;
    const pageData = await fetchPageData(token, nextCursor);

    if (pageData && pageData.peopleHistoryList) {
      // 현재 페이지의 데이터를 전체 데이터 배열에 추가
      allHistoryData = [...allHistoryData, ...pageData.peopleHistoryList];

      // 다음 페이지가 있는지 확인
      if (pageData.nextCursor) {
        nextCursor = pageData.nextCursor;
      } else {
        hasMorePages = false;
      }
    } else {
      hasMorePages = false;
    }
  }

  // 최종 응답 데이터 구성
  const responseData = {
    success: true,
    data: {
      peopleHistoryList: allHistoryData,
      nextCursor: null,
    },
  };

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// 페이지 데이터를 가져오는 함수
async function fetchPageData(token, cursor) {
  // API URL 구성
  let url = "https://salesmap.kr/api/v2/people/history";
  if (cursor) {
    url += `?cursor=${cursor}`;
  }

  try {
    // API 호출
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    // 응답 확인
    if (!response.ok) {
      console.error("API 응답 오류:", response.status);
      return { peopleHistoryList: [], nextCursor: null };
    }

    // 응답 데이터 파싱
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("API 호출 오류:", error);
    return { peopleHistoryList: [], nextCursor: null };
  }
}

// Mock 데이터 생성 함수
function getMockPages(token) {
  return {
    // 첫 번째 페이지
    first: {
      peopleHistoryList: [
        {
          id: "011f1aa-434e-7330-bd21-afdf016b257b",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "이름",
          fieldValue: "홍길동",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-29T11:16:26.207Z",
        },
        {
          id: "011f1aa-434e-7330-bd21-b582afa4042a",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "이메일",
          fieldValue: "hong@example.com",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-28T10:16:26.207Z",
        },
        {
          id: "011f1aa-434e-7330-bd21-b995e7a7b383",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "담당자",
          fieldValue: {
            _id: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
            name: "김담당",
          },
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-27T09:16:26.207Z",
        },
        {
          id: "011f1aa-434e-7330-bd21-c5b1bfdac6e5",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "생성 날짜",
          fieldValue: "2024-03-26T08:16:26.207Z",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-26T08:16:26.207Z",
        },
        {
          id: "011f1aa-434e-7330-bd21-ce022b49b468",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "전화번호",
          fieldValue: "010-1234-5678",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-25T07:16:26.207Z",
        },
      ],
      nextCursor: "second-page-cursor",
    },
    // 두 번째 페이지
    "second-page-cursor": {
      peopleHistoryList: [
        {
          id: "011f1bb-434e-8330-cd21-afdf016b257c",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "직책",
          fieldValue: "대표이사",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-24T06:16:26.207Z",
        },
        {
          id: "011f1cc-434e-9330-dd21-afdf016b257d",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "태그",
          fieldValue: "VIP",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-23T05:16:26.207Z",
        },
        {
          id: "011f1dd-434e-1330-ed21-afdf016b257e",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "고객 상태",
          fieldValue: "활성",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-22T04:16:26.207Z",
        },
        {
          id: "011f1ee-434e-2330-fd21-afdf016b257f",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "주소",
          fieldValue: "서울시 강남구",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-21T03:16:26.207Z",
        },
        {
          id: "011f1ff-434e-3330-0d21-afdf016b2570",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "메모",
          fieldValue: "중요 고객",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-20T02:16:26.207Z",
        },
      ],
      nextCursor: "third-page-cursor",
    },
    // 세 번째 페이지
    "third-page-cursor": {
      peopleHistoryList: [
        {
          id: "011f200-534e-4330-1d21-afdf016b2571",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "생일",
          fieldValue: "1980-01-15",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-19T01:16:26.207Z",
        },
        {
          id: "011f211-634e-5330-2d21-afdf016b2572",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "성별",
          fieldValue: "남성",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-18T00:16:26.207Z",
        },
        {
          id: "011f222-734e-6330-3d21-afdf016b2573",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "취미",
          fieldValue: "골프",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-17T23:16:26.207Z",
        },
        {
          id: "011f233-834e-7330-4d21-afdf016b2574",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "최근 접촉일",
          fieldValue: "2024-03-16",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-16T22:16:26.207Z",
        },
        {
          id: "011f244-934e-8330-5d21-afdf016b2575",
          peopleId: "011f1aa-42fc-7bbe-aa3f-2ee52e74a64c",
          type: "editField",
          organization: null,
          fieldName: "SNS",
          fieldValue: "@hongexample",
          ownerId: "0a538c60-416b-48d1-aaeb-6692a964b1d6",
          createdAt: "2024-03-15T21:16:26.207Z",
        },
      ],
      nextCursor: null,
    },
  };
}
