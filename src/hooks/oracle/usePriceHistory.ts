import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { type Address } from "viem";
import { usePonderSDK } from "@/context/PonderContext";
import { PonderPair } from "@/contracts/pair";

export interface PricePoint {
  timestamp: number;
  price: number;
  priceUSD: number;
  volume: bigint;
}

export interface PriceHistory {
  points: PricePoint[];
  minPrice: number;
  maxPrice: number;
  averagePrice: number;
  totalVolume: bigint;
  percentChange: number;
  currentPrice: number;
}

interface UsePriceHistoryParams {
  pair: PonderPair | undefined;
  tokenIn: Address;
  period: "1h" | "24h" | "7d" | "30d";
  enabled?: boolean;
  refetchInterval?: number;
}

export function usePriceHistory({
  pair,
  tokenIn,
  period,
  enabled = true,
  refetchInterval,
}: UsePriceHistoryParams): UseQueryResult<PriceHistory> {
  const sdk = usePonderSDK();

  return useQuery({
    queryKey: ["ponder", "priceHistory", pair?.address, tokenIn, period],
    queryFn: async () => {
      if (!pair) throw new Error("Pair is required to fetch price history.");

      const observations = await sdk.oracle.getPriceHistory(pair.address);
      const baseAmount = 10n ** 18n;

      const periodSeconds = {
        "1h": 3600,
        "24h": 86400,
        "7d": 604800,
        "30d": 2592000,
      }[period];

      const now = Math.floor(Date.now() / 1000);
      const startTime = now - periodSeconds;

      const relevantObs = observations.filter(
        (obs) => Number(obs.timestamp) >= startTime
      );

      const points: PricePoint[] = relevantObs
        .map((obs) => ({
          timestamp: Number(obs.timestamp),
          price: Number(obs.price0Cumulative) / Number(baseAmount),
          priceUSD: Number(obs.price0Cumulative) / Number(baseAmount),
          volume: 0n, // You might want to fetch actual volume data if available
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      // Calculate statistics
      const prices = points.map((p) => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const totalVolume = points.reduce((a, b) => a + b.volume, 0n);

      // Calculate percent change
      const firstPrice = prices[0] || 0;
      const lastPrice = prices[prices.length - 1] || 0;
      const percentChange =
        firstPrice === 0 ? 0 : ((lastPrice - firstPrice) / firstPrice) * 100;

      return {
        points,
        minPrice,
        maxPrice,
        averagePrice,
        totalVolume,
        percentChange,
        currentPrice: lastPrice,
      };
    },
    enabled: enabled && !!pair,
    refetchInterval,
    staleTime: 60_000, // 1 minute stale time
  });
}
