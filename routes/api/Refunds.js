import express from 'express';
import { 
    GetPendingRefunds, 
    GetRefundDetails, 
    ProcessRefund, 
    BulkProcessRefunds, 
    GetRefundStatistics ,
    GetUserRefundHistory
} from '../../Controllers/application/Refunds.js';
import {AdminAuth} from '../../middleware/AdminAuth.js';
import auth from '../../middleware/auth.js';

const router = express.Router();

router.get('/admin', AdminAuth, GetPendingRefunds);
router.get('/admin/:refundId', AdminAuth , GetRefundDetails);
router.post('/admin/:refundId/process', AdminAuth, ProcessRefund);
router.post('/admin/bulk-process', AdminAuth, BulkProcessRefunds);
router.get('/admin/statistics', AdminAuth, GetRefundStatistics);

// User Refund History
router.get('/user', auth, GetUserRefundHistory);

export default router;