import createGlobe, { type COBEOptions } from "cobe";
import { useEffect, useMemo, useRef } from "react";
import { cellToLatLng, isValidCell } from "h3-js";
import { cn } from "~/lib/utils";

export interface GlobeMarker {
	location: [number, number]; // [lat, lon]
	size?: number;
}

// h3 cell strings are converted here, client-side — cellToLatLng is
// Emscripten-backed and ~600 conversions per SSR was tripping CPU limits.
export function cellsToMarkers(cells: (string | undefined)[]): GlobeMarker[] {
	return cells
		.filter((c): c is string => !!c && isValidCell(c))
		.map((c) => ({ location: cellToLatLng(c) as [number, number], size: 0.05 }));
}

export interface GlobeArc {
	from: [number, number];
	to: [number, number];
}

// cobe v2 WebGL globe — client-only (callers lazy-load; SSR shows fallback).
export function GlobeView({
	markers,
	cells,
	arcs = [],
	className,
	dark = 1,
	autoRotate = true,
}: {
	markers?: GlobeMarker[];
	cells?: (string | undefined)[];
	arcs?: GlobeArc[];
	className?: string;
	dark?: number;
	autoRotate?: boolean;
}) {
	markers = useMemo(() => markers ?? cellsToMarkers(cells ?? []), [markers, cells]);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
	const phi = useRef(0);
	const interacting = useRef<number | null>(null);
	const movement = useRef(0);

	useEffect(() => {
		if (!canvasRef.current) return;
		const canvas = canvasRef.current;
		const options: COBEOptions = {
			devicePixelRatio: 2,
			width: canvas.offsetWidth * 2,
			height: canvas.offsetWidth * 2,
			phi: 0,
			theta: 0.3,
			dark,
			diffuse: 1.4,
			mapSamples: 20000,
			mapBrightness: 5,
			baseColor: [0.07, 0.23, 0.17], // forest
			markerColor: [0.95, 0.49, 0.39], // coral
			glowColor: [0.78, 0.95, 0.43], // lime glow
			markers: [],
			arcColor: [0.61, 0.78, 0.35],
			arcWidth: 0.4,
			arcHeight: 0.35,
		};
		const globe = createGlobe(canvas, options);
		globeRef.current = globe;

		let raf = 0;
		const tick = () => {
			if (autoRotate && interacting.current === null) phi.current += 0.003;
			globe.update({
				phi: phi.current + movement.current,
				width: canvas.offsetWidth * 2,
				height: canvas.offsetWidth * 2,
			});
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf);
			globe.destroy();
			globeRef.current = null;
		};
	}, [dark, autoRotate]);

	useEffect(() => {
		globeRef.current?.update({
			markers: markers.map((m) => ({ location: m.location, size: m.size ?? 0.045 })),
			arcs: arcs.map((a) => ({ from: a.from, to: a.to })),
		});
	}, [markers, arcs]);

	return (
		<div
			className={cn("relative aspect-square w-full select-none", className)}
			role="img"
			aria-label="Globe showing real coordination locations"
		>
			<canvas
				ref={canvasRef}
				className="h-full w-full cursor-grab active:cursor-grabbing"
				style={{ contain: "layout paint size" }}
				onPointerDown={(e) => {
					interacting.current = e.clientX - movement.current;
				}}
				onPointerUp={() => (interacting.current = null)}
				onPointerOut={() => (interacting.current = null)}
				onPointerMove={(e) => {
					if (interacting.current !== null) {
						movement.current = (e.clientX - interacting.current) / 1400;
					}
				}}
			/>
		</div>
	);
}
