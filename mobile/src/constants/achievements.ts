export type AchievementDef = {
  type: string;
  title: string;
  description: string;
  icon: string;
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    type: "first_job",
    title: "First Job",
    description: "Complete your first job",
    icon: "briefcase",
  },
  {
    type: "monthly_goal_met",
    title: "Goal Crusher",
    description: "Hit your monthly goal",
    icon: "flag",
  },
  {
    type: "streak_3mo",
    title: "3-Month Streak",
    description: "Hit your goal 3 consecutive months",
    icon: "flame",
  },
  {
    type: "streak_6mo",
    title: "6-Month Streak",
    description: "Hit your goal 6 consecutive months",
    icon: "bonfire",
  },
  {
    type: "perfect_score",
    title: "Perfect Score",
    description: "Score 5.0 on a job",
    icon: "star",
  },
  {
    type: "top_hustler",
    title: "Top Hustler",
    description: "#1 on any leaderboard category for a month",
    icon: "trophy",
  },
  {
    type: "ten_club",
    title: "10 Club",
    description: "Complete 10 jobs in a single month",
    icon: "rocket",
  },
  {
    type: "twenty_five_club",
    title: "25 Club",
    description: "Complete 25 jobs in a single month",
    icon: "diamond",
  },
];

export function getAchievementDef(type: string): AchievementDef | undefined {
  return ACHIEVEMENT_DEFS.find((a) => a.type === type);
}
