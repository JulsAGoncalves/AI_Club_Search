import { prisma } from '../lib/prisma.js';

export async function markJobRunning(jobId: string, total = 0) {
  await prisma.job.update({ where: { id: jobId }, data: { status: 'RUNNING', total, progress: 0 } });
}

export async function setJobProgress(jobId: string, progress: number, total?: number) {
  await prisma.job.update({
    where: { id: jobId },
    data: { progress, ...(total != null ? { total } : {}) },
  });
}

export async function markJobCompleted(jobId: string) {
  await prisma.job.update({ where: { id: jobId }, data: { status: 'COMPLETED' } });
}

export async function markJobFailed(jobId: string, error: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'FAILED', error: error.slice(0, 1000) },
  });
}

export async function markJobCancelled(jobId: string) {
  await prisma.job.update({ where: { id: jobId }, data: { status: 'CANCELLED' } });
}

export async function isJobCancelled(jobId: string): Promise<boolean> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  return job?.status === 'CANCELLED';
}
