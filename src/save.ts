/* eslint-disable prettier/prettier */
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { Octokit } from "octokit";

import { Events, Inputs, State } from "./constants";
import * as utils from "./utils/actionUtils";

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on("uncaughtException", e => utils.logWarning(e.message));

async function run(): Promise<void> {
    try {
        if (!utils.isCacheFeatureAvailable()) {
            return;
        }

        if (!utils.isValidEvent()) {
            utils.logWarning(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported because it's not tied to a branch or tag ref.`
            );
            return;
        }

        const state = utils.getCacheState();

        // Inputs are re-evaluted before the post action, so we want the original key used for restore
        const data = core.getState(State.CachePrimaryKey);
        const primaryKey = data.split(":")[0];

        const octokit = new Octokit({
            auth: data.split(":")[1]
        });
        if (!primaryKey) {
            utils.logWarning(`Error retrieving key from state.`);
            return;
        }

        if (utils.isExactKeyMatch(primaryKey, state)) {
            core.info(
                `Cache hit occurred on the primary key ${primaryKey}, resaving cache.`
            );
            await octokit.request(`DELETE /repos/{owner}/{repo}/actions/caches?key=${primaryKey}`, {
                owner: "ahqsoftwares",
                repo: "tauri-ahq-store"
            });
        }

        const cachePaths = utils.getInputAsArray(Inputs.Path, {
            required: true
        });

        const cacheId = await cache.saveCache(cachePaths, primaryKey, {
            uploadChunkSize: utils.getInputAsInt(Inputs.UploadChunkSize)
        });

        if (cacheId != -1) {
            core.info(`Cache saved with key: ${primaryKey}`);
        }
    } catch (error: unknown) {
        utils.logWarning((error as Error).message);
    }
}

run();

export default run;
