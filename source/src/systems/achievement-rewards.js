import { getAchievement } from "../data/achievement-data.js";
import { normalizeAchievementProgress } from "./career.js";
import { grantReward } from "./rewards.js";

export function settleAchievementRewards(state, now = Date.now()) {
  let nextState = state;
  let progress = normalizeAchievementProgress(state.achievementProgress);
  for (const [achievementId, entry] of Object.entries(progress.unlocked)) {
    if (entry.rewardResolved) continue;
    const achievement = getAchievement(achievementId);
    if (!achievement?.reward) {
      progress = {
        ...progress,
        unlocked: {
          ...progress.unlocked,
          [achievementId]: { ...entry, rewardResolved: true },
        },
      };
      continue;
    }
    nextState = grantReward(nextState, achievement.reward, {
      sourceId: achievementId,
      resolutionKey: `${achievementId}:B:${achievement.reward.contentId ?? achievement.reward.id}`,
      now,
    }).state;
    progress = normalizeAchievementProgress(nextState.achievementProgress);
    progress = {
      ...progress,
      unlocked: {
        ...progress.unlocked,
        [achievementId]: { ...entry, rewardResolved: true },
      },
    };
  }
  return { ...nextState, achievementProgress: progress };
}
