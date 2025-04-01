export async function GET(request) {
  // Get the cursor from the URL query parameters
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor');
  
  // Get the authorization header
  const authHeader = request.headers.get('authorization');
  
  // Check if the authorization header is present
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: '인증이 필요합니다.' 
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
  
  // Extract the token
  const token = authHeader.split(' ')[1];
  
  // Validate the token (this is a mock validation)
  if (!token || token.length < 10) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: '유효하지 않은 토큰입니다.' 
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
  
  // 모든 페이지의 데이터를 저장할 배열 초기화
  let allHistoryData = [];
  let nextCursor = cursor || null;
  let hasMorePages = true;
  
  // 모든 페이지 데이터 가져오기
  while (hasMorePages) {
    // 현재 cursor에 해당하는 데이터 가져오기
    const pageData = await fetchPageData(token, nextCursor);
    
    if (pageData && pageData.organizationHistoryList) {
      // 현재 페이지의 데이터를 전체 데이터 배열에 추가
      allHistoryData = [...allHistoryData, ...pageData.organizationHistoryList];
      
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
      organizationHistoryList: allHistoryData,
      nextCursor: null
    }
  };
  
  return new Response(
    JSON.stringify(responseData),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

// 페이지 데이터를 가져오는 함수
async function fetchPageData(token, cursor) {
  // API URL 구성
  let url = 'https://salesmap.kr/api/v2/organization/history';
  if (cursor) {
    url += `?cursor=${cursor}`;
  }
  
  try {
    // API 호출
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    // 응답 확인
    if (!response.ok) {
      console.error('API 응답 오류:', response.status);
      return { organizationHistoryList: [], nextCursor: null };
    }
    
    // 응답 데이터 파싱
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('API 호출 오류:', error);
    return { organizationHistoryList: [], nextCursor: null };
  }
}
}