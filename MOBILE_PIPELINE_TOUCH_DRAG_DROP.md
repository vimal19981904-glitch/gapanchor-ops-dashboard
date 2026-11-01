# 📱 Mobile Pipeline "Rolling Pipeline" Touch Drag-and-Drop Architecture & Specification

## Executive Summary & Scope

This specification documents the thumb-driven **"Rolling Pipeline"** touch drag-and-drop interaction designed strictly for **mobile phone viewports** (viewport width < 768px, including iPhone 16 @ 393×852 down to compact screens @ 360×740).

### Non-Negotiable Hard Rules Enforced
1. **MOBILE ONLY (`< 768px`)**:
   - At tablet (`768px`, `1024px`) and desktop (`1440px+`) widths, the system renders the existing desktop pipeline board with **zero changes** to markup, styles, event listeners, or behavior.
   - Desktop HTML5 native drag-and-drop continues to operate with zero interference.
2. **Component Isolation & Zero Side Effects**:
   - Built modularly in dedicated files:
     - [`components/pipeline/MobilePipelineRoller.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/components/pipeline/MobilePipelineRoller.tsx)
     - [`hooks/useIsMobile.ts`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/hooks/useIsMobile.ts)
   - Mounted conditionally inside [`components/pipeline/DailyPipelineBoard.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/components/pipeline/DailyPipelineBoard.tsx) under `md:hidden` and `{isMobile && <MobilePipelineRoller ... />}`.
   - **Protected core files remain 100% untouched**: [`app/enquiries/page.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/app/enquiries/page.tsx), [`lib/outlook-graph-sync.ts`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/lib/outlook-graph-sync.ts), etc.
3. **Reuse Existing CRM Mutation Logic**:
   - Invokes the exact production `handleMoveLead(leadId, newStage)` and `getStageUpdates(newStage)` functions.
   - Optimistic updates with automatic rollback on network failure.
   - 2-way database synchronization via `/api/enquiries/sync-excel` and local state persistence.
4. **Zero Feature Breakage**:
   - JARVIS voice actions (`"Remove [Key]"`, `"Remove lost"`), "Pushed by JARVIS" badges, mobile filter chips (*All*, *Top 10*, *High Priority*, *Callbacks*), "+ Add Prospect" modal, refresh trigger, kebab (`⋮`) contextual menu, and stage tab counts remain 100% operational.
5. **Aesthetic Conformance**:
   - Dark navy palette (`#020617`, `#0f172a`), cyan accent (`#22d3ee`), Google Fonts typography, glassmorphism (`backdrop-blur-xl`), and exact 7-stage color tokens:
     - **No plan yet**: Grey (`bg-slate-500`, `text-slate-400`)
     - **Uncontacted**: Cyan (`bg-sky-400`, `text-sky-300`)
     - **Aware**: Blue (`bg-blue-400`, `text-blue-300`)
     - **Evaluating**: Purple (`bg-purple-400`, `text-purple-300`)
     - **Negotiating**: Amber (`bg-amber-400`, `text-amber-300`)
     - **Committed**: Green (`bg-emerald-400`, `text-emerald-300`)
     - **Lost**: Red (`bg-rose-400`, `text-rose-300`)

---

## 4-Phase Interaction Lifecycle

```
[ Normal Mode ]
      │
      ▼  Long-press card (400ms hold, < 8px jitter)
[ Phase 1: Card Lift ] ──(Haptic Tick 12ms + Ghost Card lifts above thumb)
      │
      ▼  Screen dims, horizontal coverflow roller animates in (200ms)
[ Phase 2: Roller Display ] ──(Current stage centered, 7 large tiles >=104x132px)
      │
      ▼  Thumb moves Left / Center / Right
[ Phase 3: Auto-Roll Physics ] ──(Left 28% rolls earlier, Dead zone 44% stops, Right 28% rolls later)
      │
      ▼  Release over stage tile
[ Phase 4: Target & Drop ] ──(Ghost shrinks into tile, card height collapses, 5s undo toast)
```

### Phase 1: Long-Press Activation & Pickup
- **Hold Duration**: ~400 ms hold with an 8 px movement tolerance radius.
- **Scroll Preservation**: Any quick vertical swipe exceeding 8 px cancels the hold timer immediately, ensuring frictionless native list scrolling.
- **Visual Feedback**: While holding, the card subtly scales to `0.98` with a pulsing cyan glow ring (`ring-2 ring-cyan-400/80 animate-pulse`).
- **Activation**:
  - Haptic feedback tick triggered via `navigator.vibrate(12)` (silent graceful fallback on unsupported browsers).
  - Audio cue via `jarvisAudioFx.playWakeTone()`.
  - The card "lifts": A floating ghost card appears (`scale(1.04)`, `rotate(-2.5deg)`, heavy cyan drop shadow `shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_25px_rgba(34,211,238,0.35)]`).
  - Position offset: The ghost translates to `translate3d(x, y - 56px, 0)`, placing the card comfortably above the user's thumb so it is never obscured.
  - The original card in the list dims to a placeholder (`opacity: 0.25`, dashed border).

### Phase 2: Horizontal Coverflow Roller
- **Entrance Animation**: 200 ms cubic ease-out entrance with an ultra-dark glassmorphism backdrop (`bg-slate-950/85 backdrop-blur-xl`).
- **Initial Positioning**: The roller automatically starts centered on the lead's current stage.
- **Center Marker**: Fixed cyan glowing alignment notch (`w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,1)] animate-ping`) at the screen center indicates the active target zone.
- **7 Pipeline Tiles**:
  - Dimensions: `112px × 138px` (well exceeding the 104×132px touch target guideline).
  - Center-to-center spacing: `128px`.
  - Shows stage dot color, live stage count badge, stage title, and "Current" pill on the lead's current stage.
  - **3D Coverflow Math**:
    $$\text{Scale} = \max(0.80, 1 - 0.18 \times |dist|)$$
    $$\text{Opacity} = \max(0.52, 1 - 0.35 \times |dist|)$$
    $$\text{RotateY} = \text{clamp}(-28^\circ, 28^\circ, -dist \times 24^\circ)$$
    $$\text{TranslateZ} = \max(-120\text{px}, -|dist| \times 60\text{px})$$

### Phase 3: Auto-Roll Physics Engine
The screen width $W$ is partitioned into 3 dynamic horizontal zones:
1. **Left Edge Zone ($0 \le X < 0.28W$)**:
   - Rolls left toward earlier stages (*No plan yet*, *Uncontacted*).
   - Depth ratio: $t = \frac{0.28W - X}{0.28W}$.
   - Velocity: $v = v_{\min} + (v_{\max} - v_{\min}) \cdot t^{1.6}$, where $v_{\min} = 120\text{ px/s}$ and $v_{\max} = 1400\text{ px/s}$.
2. **Center Dead Zone ($0.28W \le X \le 0.72W$)**:
   - Dead zone spanning $44\%$ of viewport width.
   - Any residual momentum smoothly decelerates to zero in ~150 ms ($lerp = 0.16$).
   - Provides stable, steady positioning when the user holds their thumb in the middle.
3. **Right Edge Zone ($0.72W < X \le W$)**:
   - Rolls right toward later stages (*Negotiating*, *Committed*, *Lost*).
   - Depth ratio: $t = \frac{X - 0.72W}{0.28W}$.
   - Velocity: $-[v_{\min} + (v_{\max} - v_{\min}) \cdot t^{1.6}]$.
4. **Boundary Soft Stops**:
   - Elastic rubber-band clamping at stage 0 (*No plan yet*) and stage 6 (*Lost*) preventing infinite wrap-around.
5. **Frame-Rate Independence**:
   - Run in `requestAnimationFrame(loop)` with delta-time calculation $\Delta t = \min(\frac{t - t_{\text{prev}}}{1000}, 0.05)$.
   - All roller offsets and transforms are updated directly on DOM elements via refs without triggering React re-renders.

### Phase 4: Target Hit-Testing, Drop & Undo
- **Target Hit-Testing**: Evaluates pointer coordinates against computed 3D tile bounds in real time.
- **Stage Color Glow**: When a stage tile becomes the active target, it pulses with its stage-specific color halo and displays an animated drop badge: `Move to <Stage>`.
- **Haptic Tick on Target Change**: When the active target transitions to a new stage, a 10 ms haptic tick triggers.
- **Drop Execution**:
  - When released over a target stage $\ne$ current stage:
    1. Ghost card shrinks and translates into the stage tile (`scale(0.35)`, `opacity: 0`).
    2. Target tile pulses with a success glow.
    3. The card in the source list collapses its height from `220px` to `0px` with a `0.3s ease` transition.
    4. Audio chime plays (`jarvisAudioFx.playSuccessChime()`).
    5. Optimistic CRM update executes immediately via `onMoveLead(leadId, targetStage)`.
    6. Header count and stage tab counters update instantly.
    7. Persistent 5-second Sonner toast appears with an **Undo** button:
       > **Moved [Lead Name] → [Target Stage]** &nbsp; `[Undo]`
    8. Tapping `[Undo]` rolls the lead back to its previous stage with an informational notice.
- **Drop Cancellation**:
  - Releasing over the current stage, releasing outside any tile, pointer cancellation, orientation change, or window blur gracefully cancels the drag.
  - Ghost animates back to original card position and resets all drag states.

---

## Tweakable Configuration Guide

To fine-tune timing, speeds, or tile sizes, edit the `ROLLER_CONFIG` object at the top of [`components/pipeline/MobilePipelineRoller.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/components/pipeline/MobilePipelineRoller.tsx):

```typescript
export const ROLLER_CONFIG = {
  // 1. Hold duration: Time in ms before card lifts into roller mode
  HOLD_DURATION_MS: 400,

  // 2. Movement tolerance: Maximum px displacement before canceling hold
  MOVE_TOLERANCE_PX: 8,

  // 3. Zone widths: Left (28%), Dead Zone (44%), Right (28%)
  EDGE_ZONE_RATIO: 0.28,
  DEAD_ZONE_RATIO: 0.44,

  // 4. Velocities: Minimum edge speed & maximum extreme speed (px/sec)
  V_MIN_PX_S: 120,
  V_MAX_PX_S: 1400,

  // 5. Exponential speed ramp power (higher = steeper curve toward edge)
  SPEED_POWER: 1.6,

  // 6. Stage Tile Dimensions: Ergonomic thumb targets
  TILE_WIDTH: 112,
  TILE_HEIGHT: 138,
  TILE_SPACING: 128,

  // 7. Maximum 3D coverflow tilt angle
  MAX_TILT_DEG: 28,

  // 8. Dead-zone momentum decay duration
  DECELERATION_TIME_MS: 150,
};
```

---

## Accessibility & Touch Sanitation

1. **iOS Callout & Text Selection Suppression**:
   - Inline styles and CSS classes applied:
     `-webkit-touch-callout: none; -webkit-user-select: none; user-select: none;`
   - `onContextMenu={(e) => e.preventDefault()}` on all draggable elements.
2. **Scroll Lock During Drag**:
   - `touch-action: none; overscroll-behavior: contain; overflow: hidden;` applied to the document body during active drag.
   - Prevents iOS pull-to-refresh and unintended viewport panning.
   - Automatically restored upon drop or cancel.
3. **Screen Reader Announcements**:
   - Accessible live region `<div className="sr-only" aria-live="assertive">` announces:
     - *"Picked up [Lead Name]. Currently in [Stage]."*
     - *"Over [Stage Name]."*
     - *"Moved [Lead Name] to [Stage Name]."*
4. **Prefers-Reduced-Motion**:
   - Automatically detects `window.matchMedia('(prefers-reduced-motion: reduce)')`.
   - Flattens 3D tilt (`rotateY: 0deg`, `translateZ: 0px`) and shortens animation timings.

---

## Verification & Non-Regression Matrix

| Feature / Screen Size | Expected Behavior | Verification Status |
| :--- | :--- | :--- |
| **Mobile (iPhone 16: 393×852)** | Long-press card lifts ghost; roller coverflow renders; left/right auto-scrolls; drop moves lead; undo rolls back | **Passed** |
| **Mobile Compact (360×740)** | Ergonomic tile width (112px) fits within viewport; roller bounds clamped with elastic buffer | **Passed** |
| **Mobile List Scroll & Tabs** | Quick vertical swipe scrolls list normally; stage tabs switch stages smoothly | **Passed** |
| **Mobile Kebab Menu & Cards** | Tapping kebab opens stage quick-select popover; tapping card opens detail drawer | **Passed** |
| **Mobile Filter Chips** | *All*, *Top 10*, *High Priority*, *Callbacks* filter displayed leads dynamically | **Passed** |
| **Tablet (768px, 1024px)** | Renders desktop multi-column board with zero mobile drag markup or listeners | **Passed** |
| **Desktop (1440px+)** | Desktop HTML5 native drag-and-drop between columns works 100% identically | **Passed** |
| **J.A.R.V.I.S. Voice Controls** | Voice commands `"Remove [Key]"`, `"Remove lost"`, and push badges unaffected | **Passed** |
