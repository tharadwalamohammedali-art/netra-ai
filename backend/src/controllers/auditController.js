import { getAuditLogs } from '../services/auditService.js';

export function handleGetAuditLogs({ db, user }) {
  // If user is admin, they can see all logs; otherwise they see only their own logs
  const targetUserId = user.role === 'admin' ? null : user.userId;
  const logs = getAuditLogs({ db, userId: targetUserId, limit: 100 });

  return {
    status: 200,
    data: { logs }
  };
}
