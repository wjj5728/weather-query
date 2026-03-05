import { NextRequest, NextResponse } from "next/server";

type GeoItem = {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
};

type WeatherDaily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const requestBuckets = new Map<string, number[]>();

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const recent = (requestBuckets.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    requestBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  requestBuckets.set(ip, recent);
  return true;
}

async function fetchWithTimeout(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city")?.trim();
  if (!city) {
    return NextResponse.json({ error: "缺少 city 参数" }, { status: 400 });
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后重试" }, { status: 429 });
  }

  try {
    const geoRes = await fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`
    );

    if (!geoRes.ok) {
      return NextResponse.json({ error: "地理编码请求失败" }, { status: 502 });
    }

    const geoJson = (await geoRes.json()) as { results?: GeoItem[] };
    const hit = geoJson.results?.[0];
    if (!hit) {
      return NextResponse.json({ error: "未找到该城市" }, { status: 404 });
    }

    const weatherRes = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=Asia%2FShanghai`
    );

    if (!weatherRes.ok) {
      return NextResponse.json({ error: "天气请求失败" }, { status: 502 });
    }

    const weatherJson = (await weatherRes.json()) as {
      current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
        apparent_temperature?: number;
        wind_speed_10m?: number;
        time?: string;
      };
      daily?: WeatherDaily;
    };

    const current = weatherJson.current;
    const daily = weatherJson.daily;

    const forecast = (daily?.time || []).map((date, idx) => ({
      date,
      max: daily?.temperature_2m_max?.[idx],
      min: daily?.temperature_2m_min?.[idx],
    }));

    return NextResponse.json({
      city: hit.name,
      country: hit.country ?? "",
      latitude: hit.latitude,
      longitude: hit.longitude,
      current: {
        temperature: current?.temperature_2m,
        humidity: current?.relative_humidity_2m,
        feelsLike: current?.apparent_temperature,
        windSpeed: current?.wind_speed_10m,
        time: current?.time,
      },
      forecast,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return NextResponse.json({ error: "请求超时，请稍后重试" }, { status: 504 });
    }
    return NextResponse.json({ error: "服务异常" }, { status: 500 });
  }
}
