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
  const [compare, setCompare] = useState<WeatherResult[]>([]);
  const [compareSortBy, setCompareSortBy] = useState<"temperature" | "feelsLike">("temperature");

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

  async function queryWeather(targetCity: string, options?: { addCompare?: boolean }) {
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

      const weather = json as WeatherResult;

      if (options?.addCompare) {
        setCompare((prev) => {
          const dedup = [weather, ...prev.filter((x) => x.city !== weather.city)];
          return dedup.slice(0, 3);
        });
      } else {
        setData(weather);
      }

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

  function exportSnapshot() {
    const payload = {
      exportedAt: new Date().toISOString(),
      current: data,
      compare,
      favorites,
      history,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weather-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSnapshotCsv() {
    const rows = [
      ["city", "country", "temperature", "feelsLike", "humidity", "windSpeed", "time"],
      ...(data
        ? [[
            data.city,
            data.country,
            String(data.current.temperature),
            String(data.current.feelsLike),
            String(data.current.humidity),
            String(data.current.windSpeed),
            data.current.time,
          ]]
        : []),
      ...compare.map((item) => [
        item.city,
        item.country,
        String(item.current.temperature),
        String(item.current.feelsLike),
        String(item.current.humidity),
        String(item.current.windSpeed),
        item.current.time,
      ]),
    ];

    const csv = rows.map((r) => r.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([`${csv}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weather-snapshot-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <main className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">天气查询 v0.6.0</h1>
        <p className="mt-1 text-sm text-slate-500">支持多城市对比排序、历史/对比一键清空、天气快照 JSON/CSV 导出</p>

        <form onSubmit={onSubmit} className="mt-5 flex flex-wrap gap-3">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="例如：厦门"
            className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-600"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "查询中..." : "查询"}
          </button>
          <button type="button" onClick={addFavorite} className="rounded-lg border border-slate-300 px-4 py-2">
            收藏
          </button>
          <button
            type="button"
            onClick={() => void queryWeather(city, { addCompare: true })}
            className="rounded-lg border border-slate-300 px-4 py-2"
          >
            加入对比
          </button>
          <button type="button" onClick={exportSnapshot} className="rounded-lg border border-slate-300 px-4 py-2">
            导出 JSON
          </button>
          <button type="button" onClick={exportSnapshotCsv} className="rounded-lg border border-slate-300 px-4 py-2">
            导出 CSV
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
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">最近查询</p>
              <button
                type="button"
                onClick={() => persistHistory([])}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                清空历史
              </button>
            </div>
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

        {compare.length > 0 ? (
          <section className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">多城市对比</h3>
              <div className="flex items-center gap-2 text-xs">
                <span>排序：</span>
                <button
                  type="button"
                  onClick={() => setCompareSortBy("temperature")}
                  className="rounded border border-slate-300 px-2 py-1"
                >
                  按温度
                </button>
                <button
                  type="button"
                  onClick={() => setCompareSortBy("feelsLike")}
                  className="rounded border border-slate-300 px-2 py-1"
                >
                  按体感
                </button>
                <button
                  type="button"
                  onClick={() => setCompare([])}
                  className="rounded border border-slate-300 px-2 py-1"
                >
                  清空对比
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-sm">
              {[...compare]
                .sort((a, b) => b.current[compareSortBy] - a.current[compareSortBy])
                .map((item) => (
                  <div key={`${item.city}-${item.current.time}`} className="rounded-lg bg-slate-100 p-3">
                    {item.city}{item.country ? `, ${item.country}` : ""}：
                    温度 {item.current.temperature}°C，体感 {item.current.feelsLike}°C，湿度 {item.current.humidity}% ，风速 {item.current.windSpeed} km/h
                  </div>
                ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
