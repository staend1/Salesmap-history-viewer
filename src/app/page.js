"use client";

import { useState, useEffect, useMemo } from "react";

export default function Home() {
  const [token, setToken] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPeople, setSelectedPeople] = useState(null);
  const [showUtmOnly, setShowUtmOnly] = useState(false);

  const fetchPeopleHistory = async () => {
    setLoading(true);
    setError(null);
    setSelectedPeople(null);

    try {
      // Use the local API route
      const url = new URL(
        "/api/v2/people/history",
        window.location.origin
      );

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(
          `응답이 JSON 형식이 아닙니다. 받은 타입: ${
            contentType || "불명"
          }, 내용: ${text.substring(0, 150)}...`
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "API 호출 중 오류가 발생했습니다.");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
      console.error("API 호출 오류:", err);
    } finally {
      setLoading(false);
    }
  };

  // 고유한 고객 정보를 추출하는 함수
  const uniquePeople = useMemo(() => {
    if (!result || !result.data || !result.data.peopleHistoryList) return [];

    const peopleMap = new Map();
    
    result.data.peopleHistoryList.forEach(item => {
      if (!peopleMap.has(item.peopleId)) {
        // 이름 정보를 찾기 위해 해당 고객의 이름 필드 기록을 찾음
        const nameRecord = result.data.peopleHistoryList.find(
          record => record.peopleId === item.peopleId && record.fieldName === "이름"
        );
        
        // UTM 관련 필드 수집
        const utmRecords = result.data.peopleHistoryList.filter(
          record => record.peopleId === item.peopleId && 
            (record.fieldName === "utm_source" || 
             record.fieldName === "utm_medium" || 
             record.fieldName === "utm_campaign" || 
             record.fieldName === "utm_content")
        );
        
        // 최신 UTM 정보 정리
        const utmInfo = {
          utmSource: "",
          utmMedium: "",
          utmCampaign: "",
          utmContent: ""
        };
        
        // UTM 관련 필드 중 가장 최근 기록 추출
        utmRecords.forEach(record => {
          const fieldMap = {
            utm_source: "utmSource",
            utm_medium: "utmMedium",
            utm_campaign: "utmCampaign",
            utm_content: "utmContent"
          };
          
          const fieldKey = fieldMap[record.fieldName];
          if (fieldKey) {
            utmInfo[fieldKey] = record.fieldValue;
          }
        });
        
        peopleMap.set(item.peopleId, {
          id: item.peopleId,
          name: nameRecord ? nameRecord.fieldValue : "알 수 없는 이름",
          // 가장 최근 기록 시간
          lastActivity: new Date(
            Math.max(...result.data.peopleHistoryList
              .filter(record => record.peopleId === item.peopleId)
              .map(record => new Date(record.createdAt).getTime())
            )
          ),
          hasUtmFields: utmRecords.length > 0,
          utmInfo: utmInfo,
          utmCount: utmRecords.length
        });
      }
    });
    
    return Array.from(peopleMap.values());
  }, [result]);

  // 검색 결과 필터링
  const filteredPeople = useMemo(() => {
    let filtered = uniquePeople;
    
    // 검색어로 필터링
    if (searchTerm.trim()) {
      filtered = filtered.filter(person => 
        person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // UTM 필터링 적용
    if (showUtmOnly) {
      filtered = filtered.filter(person => person.hasUtmFields);
    }
    
    return filtered;
  }, [uniquePeople, searchTerm, showUtmOnly]);
  
  // 선택된 고객의 히스토리
  const selectedPersonHistory = useMemo(() => {
    if (!selectedPeople || !result || !result.data || !result.data.peopleHistoryList) return [];
    
    let history = result.data.peopleHistoryList
      .filter(item => item.peopleId === selectedPeople.id);
      
    // UTM 필드만 보기 옵션이 켜져 있으면 UTM 관련 필드만 필터링
    if (showUtmOnly) {
      history = history.filter(item => 
        item.fieldName === "utm_source" || 
        item.fieldName === "utm_medium" || 
        item.fieldName === "utm_campaign" || 
        item.fieldName === "utm_content"
      );
    }
    
    return history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [selectedPeople, result, showUtmOnly]);
  
  // UTM 타입별 정보 추출
  const utmSummary = useMemo(() => {
    if (!selectedPeople || !selectedPersonHistory.length) return null;
    
    // UTM 관련 필드만 필터링
    const utmRecords = selectedPersonHistory.filter(item => 
      item.fieldName === "utm_source" || 
      item.fieldName === "utm_medium" || 
      item.fieldName === "utm_campaign" || 
      item.fieldName === "utm_content"
    );
    
    if (utmRecords.length === 0) return null;
    
    // UTM 종류별로 중복 제거한 값 모으기
    const summary = {
      sources: new Set(),
      mediums: new Set(),
      campaigns: new Set(),
      contents: new Set(),
      dealCreationDate: null
    };
    
    // Deal 생성 날짜 확인 (딜 개수 필드가 0->1 이상으로 변경된 시점)
    const dealCountRecords = selectedPersonHistory.filter(item => 
      item.fieldName === "딜 개수"
    );
    
    // 딜 개수가 0보다 큰 최초 기록 찾기
    for (let i = dealCountRecords.length - 1; i >= 0; i--) {
      const record = dealCountRecords[i];
      if (parseInt(record.fieldValue) > 0) {
        summary.dealCreationDate = record.createdAt;
        break;
      }
    }
    
    utmRecords.forEach(record => {
      if (record.fieldName === "utm_source" && record.fieldValue) {
        summary.sources.add(record.fieldValue);
      } else if (record.fieldName === "utm_medium" && record.fieldValue) {
        summary.mediums.add(record.fieldValue);
      } else if (record.fieldName === "utm_campaign" && record.fieldValue) {
        summary.campaigns.add(record.fieldValue);
      } else if (record.fieldName === "utm_content" && record.fieldValue) {
        summary.contents.add(record.fieldValue);
      }
    });
    
    return {
      sources: Array.from(summary.sources),
      mediums: Array.from(summary.mediums),
      campaigns: Array.from(summary.campaigns),
      contents: Array.from(summary.contents),
      dealCreationDate: summary.dealCreationDate,
      totalCount: utmRecords.length
    };
  }, [selectedPeople, selectedPersonHistory]);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-8">고객 히스토리 조회</h1>

      <div className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">인증</h2>

        <div className="mb-4">
          <label
            htmlFor="token"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            토큰 입력
          </label>
          <input
            id="token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Bearer 토큰을 입력하세요"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={fetchPeopleHistory}
          disabled={!token || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? "로딩 중..." : "고객 정보 가져오기"}
        </button>
      </div>

      {error && (
        <div className="w-full max-w-4xl bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-bold">오류</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 고객 목록 패널 */}
          <div className="bg-white p-4 rounded-lg shadow-md md:col-span-1">
            <h3 className="text-lg font-semibold mb-3">고객 목록</h3>
            
            <div className="mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="고객 이름 검색..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="mb-4 flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUtmOnly}
                  onChange={() => setShowUtmOnly(!showUtmOnly)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">UTM 히스토리만 보기</span>
              </label>
            </div>
            
            <div className="overflow-y-auto max-h-[60vh]">
              {filteredPeople.length === 0 ? (
                <p className="text-gray-500 text-center py-4">검색 결과가 없습니다</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {filteredPeople.map(person => (
                    <li 
                      key={person.id} 
                      className={`py-3 px-2 cursor-pointer hover:bg-gray-50 transition-colors duration-150 ${selectedPeople?.id === person.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                      onClick={() => setSelectedPeople(person)}
                    >
                      <div className="font-medium">{person.name}</div>
                      <div className="text-sm text-gray-500 truncate">{person.id}</div>
                      <div className="text-xs text-gray-400">
                        최근 활동: {person.lastActivity.toLocaleString()}
                      </div>
                      {person.hasUtmFields && (
                        <div className="mt-2 border-t border-gray-100 pt-2">
                          <div className="text-xs font-medium text-blue-600">UTM 정보</div>
                          {person.utmInfo.utmSource && (
                            <div className="text-xs text-gray-700">
                              <span className="font-medium">Source:</span> {person.utmInfo.utmSource}
                            </div>
                          )}
                          {person.utmInfo.utmMedium && (
                            <div className="text-xs text-gray-700">
                              <span className="font-medium">Medium:</span> {person.utmInfo.utmMedium}
                            </div>
                          )}
                          {person.utmInfo.utmCampaign && (
                            <div className="text-xs text-gray-700">
                              <span className="font-medium">Campaign:</span> {person.utmInfo.utmCampaign}
                            </div>
                          )}
                          {person.utmCount > 0 && (
                            <div className="text-xs text-blue-500 mt-1">
                              총 {person.utmCount}개의 UTM 기록
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {/* 히스토리 패널 */}
          <div className="bg-white p-4 rounded-lg shadow-md md:col-span-2">
            {selectedPeople ? (
              <>
                <h3 className="text-lg font-semibold mb-1">{selectedPeople.name} 고객 히스토리</h3>
                <p className="text-sm text-gray-500 mb-4">ID: {selectedPeople.id}</p>
                
                {/* UTM 요약 정보 표시 */}
                {utmSummary && (
                  <div className="bg-blue-50 p-4 rounded-md mb-4 border border-blue-100">
                    <h4 className="text-md font-semibold text-blue-700 mb-2">UTM 마케팅 경로 요약 정보</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {utmSummary.sources.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-blue-800">Source ({utmSummary.sources.length})</h5>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {utmSummary.sources.map((source, index) => (
                              <span key={index} className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                {source}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {utmSummary.mediums.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-blue-800">Medium ({utmSummary.mediums.length})</h5>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {utmSummary.mediums.map((medium, index) => (
                              <span key={index} className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                                {medium}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {utmSummary.campaigns.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-blue-800">Campaign ({utmSummary.campaigns.length})</h5>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {utmSummary.campaigns.map((campaign, index) => (
                              <span key={index} className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                                {campaign}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {utmSummary.contents.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-blue-800">Content ({utmSummary.contents.length})</h5>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {utmSummary.contents.map((content, index) => (
                              <span key={index} className="inline-block px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded truncate max-w-full">
                                {content}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 text-sm text-blue-700">
                      총 <span className="font-bold">{utmSummary.totalCount}</span>개의 UTM 관련 기록이 있습니다.
                    </div>
                    
                    {utmSummary.dealCreationDate && (
                      <div className="mt-3 text-sm border-t border-blue-100 pt-2">
                        <span className="font-medium text-blue-800">Deal - 생성 날짜:</span>
                        <span className="ml-2">{new Date(utmSummary.dealCreationDate).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200 rounded-md">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">필드명</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">필드값</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">변경일시</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedPersonHistory.map((item) => (
                        <tr key={item.id} className={`hover:bg-gray-50 ${
                          item.fieldName.startsWith('utm_') ? 'bg-blue-50' : ''
                        }`}>
                          <td className="px-4 py-3 text-sm">
                            {item.fieldName.startsWith('utm_') ? (
                              <span className="font-medium text-blue-700">{item.fieldName}</span>
                            ) : (
                              item.fieldName
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm break-all">
                            {typeof item.fieldValue === "object"
                              ? JSON.stringify(item.fieldValue)
                              : String(item.fieldValue)}
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            {new Date(item.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-center">좌측에서 고객을 선택하면 히스토리가 표시됩니다</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}