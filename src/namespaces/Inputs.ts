import type { Actions, Annotations, Images } from "./GitHub";

interface ArgsBase {
	actions?: Actions;

	actionURL?: string;
	annotations?: Annotations;
	conclusion?: Conclusion;
	detailsURL?: string;
	images?: Images;

	output?: Output;
	repo?: string;
	sha?: string;
	status: Status;
	token: string;
}

export interface ArgsCreate extends ArgsBase {
	name: string;
}

export interface ArgsUpdate extends ArgsBase {
	checkID: number;
}

export type Args = ArgsCreate | ArgsUpdate;

export type Output = {
	title?: string;
	summary: string;
	text_description?: string;
};

export enum Conclusion {
	Success = "success",
	Failure = "failure",
	Neutral = "neutral",
	Cancelled = "cancelled",
	TimedOut = "timed_out",
	ActionRequired = "action_required",
	Skipped = "skipped",
}

export enum Status {
	Queued = "queued",
	InProgress = "in_progress",
	Completed = "completed",
}
