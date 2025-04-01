"use client";

import { useState } from "react";

export default function Home() {
  const [token, setToken] = useState("");
  const [cursor, setCursor] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoFetch, setAutoFetch] = useState(true);

  const fetchPeopleHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use the local API route
      const url = new URL(
        "/api/v2/people/history",
        window.location.origin
      );
      if (cursor) {
        url.searchParams.append("cursor", cursor);
      }

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
      if (data.data?.nextCursor && autoFetch) {
        setCursor(data.data.nextCursor);
        setTimeout(() => fetchPeopleHistory(), 100);
      }
    } catch (err) {
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
      console.error("API 호출 오류:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 md:p-24">
      <h1 className="text-3xl font-bold mb-8">고객 히스토리 조회</h1>

      <div className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">
          고객 히스토리 조회
        </h2>

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

        <div className="mb-4">
          <label
            htmlFor="cursor"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            커서 (선택 사항)
          </label>
          <input
            id="cursor"
            type="text"
            value={cursor}
            onChange={(e) => setCursor(e.target.value)}
            placeholder="페이지네이션 커서"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4 flex items-center">
          <input
            id="autoFetch"
            type="checkbox"
            checked={autoFetch}
            onChange={(e) => setAutoFetch(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="autoFetch"
            className="ml-2 block text-sm text-gray-700"
          >
            자동으로 모든 페이지 가져오기
          </label>
        </div>

        <button
          onClick={fetchPeopleHistory}
          disabled={!token || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? "로딩 중..." : "히스토리 조회"}
        </button>
      </div>

      {error && (
        <div className="w-full max-w-4xl bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-bold">오류</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="w-full max-w-4xl">
          <h3 className="text-xl font-semibold mb-2">응답 결과</h3>

          <div className="mb-2">
            <h4 className="font-medium text-lg mb-2">고객 히스토리 목록</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-300 rounded-md">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border-b px-4 py-2 text-left">ID</th>
                    <th className="border-b px-4 py-2 text-left">고객 ID</th>
                    <th className="border-b px-4 py-2 text-left">타입</th>
                    <th className="border-b px-4 py-2 text-left">필드명</th>
                    <th className="border-b px-4 py-2 text-left">필드값</th>
                    <th className="border-b px-4 py-2 text-left">소유자 ID</th>
                    <th className="border-b px-4 py-2 text-left">생성일시</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.peopleHistoryList.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="border-b px-4 py-2">{item.id}</td>
                      <td className="border-b px-4 py-2">
                        {item.peopleId}
                      </td>
                      <td className="border-b px-4 py-2">{item.type}</td>
                      <td className="border-b px-4 py-2">{item.fieldName}</td>
                      <td className="border-b px-4 py-2">
                        {typeof item.fieldValue === "object"
                          ? JSON.stringify(item.fieldValue)
                          : String(item.fieldValue)}
                      </td>
                      <td className="border-b px-4 py-2">{item.ownerId}</td>
                      <td className="border-b px-4 py-2">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result.data.nextCursor && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                다음 페이지 커서: {result.data.nextCursor}
              </p>
            </div>
          )}

          <div className="mb-4">
            <h4 className="font-medium text-lg mb-2">원본 JSON</h4>
            <pre className="bg-gray-800 text-white p-4 rounded-md overflow-x-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </main>
  );
}
