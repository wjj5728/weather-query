"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ForecastItem = {
  date: string;
  max: number;
  min: number;
};

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
  forecast: ForecastItem[];
};

const FAV_KEY = "weather-favorites";
const HISTORY_KEY = "weather-history";

function TempTrend({ forecast }: { forecast: ForecastItem[] }) {
  const points = useMemo(() => {
    if (!forecast.length) return "";
    const width = 520;
    const height = 140;
    const maxVal = Math.max(...forecast.map((x) => x.max));
    const minVal = Math.min(...forecast.map((x) => x.min));
    const range = Math.max(1, maxVal - minVal);

    return forecast
      .map((item, idx) => {
        const x = (idx / Math.max(1, forecast.length - 1)) * width;
        const y = height - ((item.max - minVal) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");
  }, [forecast]);

  return (
    <svg viewBox="0 0 520 140" className="h-36 w-full rounded-lg bg-slate-100 p-2">
      <polyline points={points} fill="none" stroke="#0f172a" strokeWidth="3" />
    </svg>
  );
}

export default function Home() {
  const [city, setCity] = useState("厦门");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<WeatherResult | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const f = localStorage.getItem(FAV_KEY);
    const h = localStorage.getItem(HISTORY_KEY);
    if (f) setFavorites(JSON.parse(f));
    if (h) setHistory(JSON.parse(h));
  }, []);

  function persistFav(next: string[]) {
    setFavorites(next);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  }

  function persistHistory(next: string[]) {
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  async function queryWeather(targetCity: string) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(targetCity)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "查询失败");
        setData(null);
        return;
      }
      setData(json);

      const nextHistory = [targetCity, ...history.filter((x) => x !== targetCity)].slice(0, 8);
      persistHistory(nextHistory);
    } catch {
      setError("网络异常，请稍后重试");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await queryWeather(city);
  }

  function addFavorite() {
    const key = city.trim();
    if (!key) return;
    if (favorites.includes(key)) return;
    persistFav([key, ...favorites].slice(0, 8));
  }

  function removeFavorite(item: string) {
    persistFav(favorites.filter((x) => x !== item));
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <main className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">天气查询 v0.4.0</h1>
        <p className="mt-1 text-sm text-slate-500">输入城市名，查看当前天气 + 未来 7 天预报，支持收藏/历史、超时提示与防刷限流</p>

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
          <button
            type="button"
            onClick={addFavorite}
            className="rounded-lg border border-slate-300 px-4 py-2"
          >
            收藏
          </button>
        </form>

        {favorites.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold">收藏城市</p>
            <div className="flex flex-wrap gap-2">
              {favorites.map((item) => (
                <div key={item} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm">
                  <button type="button" onClick={() => { setCity(item); void queryWeather(item); }}>{item}</button>
                  <button type="button" onClick={() => removeFavorite(item)} className="text-slate-500">×</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {history.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold">最近查询</p>
            <div className="flex flex-wrap gap-2">
              {history.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setCity(item);
                    void queryWeather(item);
                  }}
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void queryWeather(city)}
              className="mt-2 rounded border border-red-300 px-3 py-1 text-xs"
            >
              重试
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="h-10 animate-pulse rounded bg-slate-100" />
              <div className="h-10 animate-pulse rounded bg-slate-100" />
              <div className="h-10 animate-pulse rounded bg-slate-100" />
              <div className="h-10 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ) : null}

        {!loading && !data && !error ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            请输入城市开始查询，例如：厦门、上海、北京。
          </div>
        ) : null}

        {data ? (
          <section className="mt-6 rounded-xl border border-slate-200 p-4">
            <h2 className="text-xl font-semibold">
              {data.city}
              {data.country ? `, ${data.country}` : ""}
            </h2>
            <p className="mt-2 text-sm text-slate-500">更新时间：{data.current.time}</p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-100 p-3">温度：{data.current.temperature}°C</div>
              <div className="rounded-lg bg-slate-100 p-3">体感：{data.current.feelsLike}°C</div>
              <div className="rounded-lg bg-slate-100 p-3">湿度：{data.current.humidity}%</div>
              <div className="rounded-lg bg-slate-100 p-3">风速：{data.current.windSpeed} km/h</div>
            </div>

            <h3 className="mt-6 text-lg font-semibold">未来 7 天温度趋势（最高温）</h3>
            <div className="mt-3">
              <TempTrend forecast={data.forecast} />
            </div>

            <div className="mt-4 grid gap-2 text-sm">
              {data.forecast.map((item) => (
                <div key={item.date} className="rounded-lg bg-slate-100 p-3">
                  {item.date}：最高 {item.max}°C / 最低 {item.min}°C
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
