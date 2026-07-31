import { useEffect, useMemo } from "react";
import { MouseEventParams } from "cochart-charts";
import { useChartStore } from "@/stores/useChartStore";
import { useCollabStore } from "@/stores/useCollabStore";
import { coordinateToTimeExtrapolated } from "@/core/chart/interval";
import { throttle } from "@/lib/throttle";
import { logger } from "@/lib/logger";

// Cap cursor broadcasts to ~25/s: frequent enough to feel live, light enough
// not to flood the room socket.
const CURSOR_THROTTLE_MS = 40;

/**
 * Broadcasts this browser's pointer position over the collab socket as chart
 * coordinates (time + price) while in a room, so peers can render a live cursor
 * anchored to the same candle regardless of their own zoom/pan.
 */
export function useCursorBroadcast() {
  const chartApi = useChartStore((s) => s.chartApi);
  const seriesApi = useChartStore((s) => s.seriesApi);

  // A stable throttled sender; reads the latest broadcast fn from the store on
  // each invocation so it never goes stale.
  const send = useMemo(
    () =>
      throttle((time: number, price: number, hidden: boolean) => {
        useCollabStore.getState().broadcastCursor(time, price, hidden);
      }, CURSOR_THROTTLE_MS),
    [],
  );

  useEffect(() => {
    if (!chartApi || !seriesApi) return;

    const handler = (param: MouseEventParams) => {
      // Only chatter while actually collaborating.
      if (!useCollabStore.getState().roomId) return;
      try {
        // Pointer left the chart pane — tell peers to drop our marker.
        if (!param.point) {
          send(0, 0, true);
          return;
        }
        const price = seriesApi.coordinateToPrice(param.point.y);
        const time =
          typeof param.time === "number"
            ? param.time
            : coordinateToTimeExtrapolated(chartApi, seriesApi, param.point.x);
        if (typeof price !== "number" || typeof time !== "number") return;
        send(time, price, false);
      } catch (e) {
        logger.error("cursor broadcast failed: ", e);
      }
    };

    chartApi.subscribeCrosshairMove(handler);
    return () => {
      send.cancel();
      try {
        chartApi.unsubscribeCrosshairMove(handler);
      } catch (e) {
        logger.error("cursor broadcast cleanup failed: ", e);
      }
    };
  }, [chartApi, seriesApi, send]);
}
