import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { LandingScene } from './scenes/LandingScene';
import { AccessScene } from './scenes/AccessScene';
import { OverviewRadarScene } from './scenes/OverviewRadarScene';
import { MarketDiscoveryScene } from './scenes/MarketDiscoveryScene';
import { AlertsScene } from './scenes/AlertsScene';
import { AnalyticsAgentScene } from './scenes/AnalyticsAgentScene';
import { ProResearchScene } from './scenes/ProResearchScene';
import { SettingsAdminOutroScene } from './scenes/SettingsAdminOutroScene';

// Scene durations (at 24fps):
// 1. LandingScene: 135 frames
// 2. AccessScene: 135 frames
// 3. OverviewRadarScene: 140 frames
// 4. MarketDiscoveryScene: 150 frames
// 5. AlertsScene: 135 frames
// 6. AnalyticsAgentScene: 150 frames
// 7. ProResearchScene: 145 frames
// 8. SettingsAdminOutroScene: 145 frames
// Sum = 1135 frames. Minus 7 transitions of 10 frames (70 frames) = 1065 frames (~44.4 seconds @ 24fps)
export const TOTAL_DURATION_FRAMES = 1065;

export const NarraxIntroVideo: React.FC = () => {
  const transitionTiming = linearTiming({ durationInFrames: 10 });

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={135}>
        <LandingScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: 'from-right' })}
        timing={transitionTiming}
      />

      <TransitionSeries.Sequence durationInFrames={135}>
        <AccessScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={transitionTiming}
      />

      <TransitionSeries.Sequence durationInFrames={140}>
        <OverviewRadarScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={transitionTiming}
      />

      <TransitionSeries.Sequence durationInFrames={150}>
        <MarketDiscoveryScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={transitionTiming}
      />

      <TransitionSeries.Sequence durationInFrames={135}>
        <AlertsScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={transitionTiming}
      />

      <TransitionSeries.Sequence durationInFrames={150}>
        <AnalyticsAgentScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={transitionTiming}
      />

      <TransitionSeries.Sequence durationInFrames={145}>
        <ProResearchScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={transitionTiming}
      />

      <TransitionSeries.Sequence durationInFrames={145}>
        <SettingsAdminOutroScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NarraxIntro"
        component={NarraxIntroVideo}
        durationInFrames={TOTAL_DURATION_FRAMES}
        fps={24}
        width={1920}
        height={1080}
      />
    </>
  );
};

registerRoot(RemotionRoot);
