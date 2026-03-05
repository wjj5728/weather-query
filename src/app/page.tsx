"use client";

import { FormEvent, useState } from "react";

type WeatherResult = {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  current: {
    temperature: number;
    humidity: number;
    feelsLike: number;
    windSpeed: number;
    time: string;
  };
};

export default function Home() {
  const [city, setCity] = useState("厦门");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<WeatherResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "查询失败");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("网络异常，请稍后重试");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <main className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">天气查询 v0.1.0</h1>
        <p className="mt-1 text-sm text-slate-500">输入城市名，查看当前天气（温度、体感、湿度、风速）</p>

        <form onSubmit={onSubmit} className="mt-5 flex gap-3">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="例如：厦门"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-600"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "查询中..." : "查询"}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {data ? (
          <section className="mt-6 rounded-xl border border-slate-200 p-4">
            <h2 className="text-xl font-semibold">{data.city}{data.country ? `, ${data.country}` : ""}</h2>
            <p className="mt-2 text-sm text-slate-500">更新时间：{data.current.time}</p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-100 p-3">温度：{data.current.temperature}°C</div>
              <div className="rounded-lg bg-slate-100 p-3">体感：{data.current.feelsLike}°C</div>
              <div className="rounded-lg bg-slate-100 p-3">湿度：{data.current.humidity}%</div>
              <div className="rounded-lg bg-slate-100 p-3">风速：{data.current.windSpeed} km/h</div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
