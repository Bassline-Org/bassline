/**
 * Async Task Tracking System
 *
 * Provides observable, non-blocking async execution for Bassline
 */

// Generate unique task IDs
let taskIdCounter = 0;
function generateTaskId() {
    return `task-${Date.now()}-${taskIdCounter++}`;
}

// Task registry - global state for all async tasks
const taskRegistry = new Map();

/**
 * Create a new async task
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Task options (name, etc)
 * @returns {Object} Task handle
 */
export function createTask(fn, options = {}) {
    const taskId = generateTaskId();
    const task = {
        id: taskId,
        name: options.name || `Task ${taskId}`,
        status: "pending",
        result: null,
        error: null,
        startTime: Date.now(),
        endTime: null,
        promise: null,
    };

    // Store in registry
    taskRegistry.set(taskId, task);

    // Execute the async function
    task.promise = (async () => {
        try {
            const result = await fn();
            task.status = "complete";
            task.result = result;
            task.endTime = Date.now();
            return result;
        } catch (error) {
            task.status = "error";
            task.error = error;
            task.endTime = Date.now();
            throw error;
        }
    })();

    return task;
}

/**
 * Get a task by ID
 * @param {string} taskId - Task ID
 * @returns {Object|null} Task or null if not found
 */
export function getTask(taskId) {
    return taskRegistry.get(taskId) || null;
}

/**
 * Get all tasks
 * @returns {Array} Array of all tasks
 */
export function getAllTasks() {
    return Array.from(taskRegistry.values());
}

/**
 * Get task status
 * @param {string} taskId - Task ID
 * @returns {string} Status: "pending" | "complete" | "error" | "not-found"
 */
export function getTaskStatus(taskId) {
    const task = getTask(taskId);
    return task ? task.status : "not-found";
}

/**
 * Await task completion
 * @param {Object} task - Task handle
 * @returns {Promise<any>} Task result
 */
export async function awaitTask(task) {
    if (!task || !task.promise) {
        throw new Error("Invalid task handle");
    }
    return await task.promise;
}

/**
 * Cancel a task (best effort - may not be cancellable)
 * @param {string} taskId - Task ID
 * @returns {boolean} True if cancelled, false otherwise
 */
export function cancelTask(taskId) {
    const task = getTask(taskId);
    if (!task) return false;

    if (task.status === "pending") {
        // Mark as cancelled (actual cancellation depends on the operation)
        task.status = "cancelled";
        task.endTime = Date.now();
        return true;
    }

    return false;
}

/**
 * Clean up completed tasks older than the given age
 * @param {number} maxAge - Max age in milliseconds (default: 5 minutes)
 */
export function cleanupOldTasks(maxAge = 5 * 60 * 1000) {
    const now = Date.now();
    const toDelete = [];

    for (const [id, task] of taskRegistry.entries()) {
        if (task.status !== "pending" && task.endTime) {
            const age = now - task.endTime;
            if (age > maxAge) {
                toDelete.push(id);
            }
        }
    }

    toDelete.forEach(id => taskRegistry.delete(id));
    return toDelete.length;
}

/**
 * Get task statistics
 * @returns {Object} Statistics about tasks
 */
export function getTaskStats() {
    const tasks = getAllTasks();
    return {
        total: tasks.length,
        pending: tasks.filter(t => t.status === "pending").length,
        complete: tasks.filter(t => t.status === "complete").length,
        error: tasks.filter(t => t.status === "error").length,
        cancelled: tasks.filter(t => t.status === "cancelled").length,
    };
}
