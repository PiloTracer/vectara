"use client";

import { useState, useEffect, useCallback } from "react";

interface JobStatus {
    id: string;
    resource_id: string | null;
    type: string;
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
    progress: {
        message?: string;
        processed?: number;
        total?: number;
        files?: Array<{ path: string; chars: number; chunks: number; type: string }>;
        errors?: Array<{ path: string; error: string }>;
    };
    error: string | null;
}

interface UseJobStatusOptions {
    pollInterval?: number; // ms, default 2000
    onComplete?: (job: JobStatus) => void;
    onError?: (job: JobStatus) => void;
}

export function useJobStatus(
    jobId: string | null,
    options: UseJobStatusOptions = {}
) {
    const { pollInterval = 2000, onComplete, onError } = options;
    const [job, setJob] = useState<JobStatus | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchJobStatus = useCallback(async () => {
        if (!jobId) return null;

        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:18080";
            const res = await fetch(`${backendUrl}/resources/jobs/${jobId}`);

            if (!res.ok) {
                throw new Error(`Failed to fetch job status: ${res.status}`);
            }

            const data: JobStatus = await res.json();
            setJob(data);
            setError(null);
            return data;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            setError(message);
            return null;
        }
    }, [jobId]);

    // Polling effect
    useEffect(() => {
        if (!jobId) {
            setJob(null);
            setIsPolling(false);
            return;
        }

        setIsPolling(true);
        let intervalId: NodeJS.Timeout | null = null;

        const poll = async () => {
            const result = await fetchJobStatus();

            if (result) {
                // Stop polling if job is terminal
                if (result.status === "COMPLETED") {
                    setIsPolling(false);
                    if (intervalId) clearInterval(intervalId);
                    onComplete?.(result);
                } else if (result.status === "FAILED") {
                    setIsPolling(false);
                    if (intervalId) clearInterval(intervalId);
                    onError?.(result);
                }
            }
        };

        // Initial fetch
        poll();

        // Start polling
        intervalId = setInterval(poll, pollInterval);

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [jobId, pollInterval, fetchJobStatus, onComplete, onError]);

    return {
        job,
        isPolling,
        error,
        refetch: fetchJobStatus,
    };
}
