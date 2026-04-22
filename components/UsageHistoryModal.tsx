import React, { useEffect, useState } from 'react';
import { X, Calendar, Activity, Cpu, FileText } from 'lucide-react';
import { User } from '../types';
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface UsageHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

interface UsageRecord {
    id: string;
    action: string;
    tokens: number;
    timestamp: any;
    details?: any;
}

const UsageHistoryModal: React.FC<UsageHistoryModalProps> = ({ isOpen, onClose, user }) => {
    const [history, setHistory] = useState<UsageRecord[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !user?.id) {
            setHistory([]);
            return;
        }

        setLoading(true);
        const db = getFirestore();
        // Realtime listener for history
        const q = query(
            collection(db, 'users', user.id, 'usage_history'),
            orderBy('timestamp', 'desc'),
            limit(50) // Limit to last 50 actions for performance
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const records = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as UsageRecord[];
            setHistory(records);
            setLoading(false);
        }, (err) => {
            console.error("Failed to fetch history:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, user]);

    if (!isOpen) return null;

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        // Firestore timestamp to multiple formats handling
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    const formatAction = (action: string) => {
        return action.replace(/_/g, ' ');
    };

    const renderDetails = (details: any) => {
        if (!details) return '-';
        // Prioritize specific fields for cleaner display
        if (details.url) return <a href={details.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate max-w-[200px] block">{details.url}</a>;
        if (details.fileName) return <span className="font-medium text-slate-600">{details.fileName}</span>;
        if (details.brandName) return <span>Brand: {details.brandName}</span>;
        if (details.topic) return <span className="italic">{details.topic}</span>;

        // Fallback: simple stringify for debug/other
        const clean = { ...details };
        return <span className="text-xs text-slate-400 truncate max-w-[200px] block" title={JSON.stringify(clean)}>{JSON.stringify(clean).substring(0, 30)}...</span>;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-[#102d62] flex items-center gap-2">
                            <Activity className="text-cyan" size={24} />
                            Lịch Sử Hoạt Động AI
                        </h2>
                        <p className="text-sm text-slate-500 font-medium">
                            Người dùng: <span className="text-navy font-bold">{user?.name || user?.email}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-slate-50">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto custom-scrollbar p-0 bg-slate-50/50">
                    {loading && history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
                            <div className="w-8 h-8 border-4 border-cyan/30 border-t-cyan rounded-full animate-spin"></div>
                            <span className="text-sm font-medium">Đang tải dữ liệu...</span>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
                            <FileText size={40} className="opacity-20" />
                            <span className="text-sm">Chưa có lịch sử hoạt động nào.</span>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0 shadow-sm z-10 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 w-40">Thời gian</th>
                                    <th className="px-6 py-4 w-48">Hành động</th>
                                    <th className="px-6 py-4 w-32">Tokens</th>
                                    <th className="px-6 py-4">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {history.map((record) => (
                                    <tr key={record.id} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-slate-300" />
                                                {formatDate(record.timestamp)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-tight">
                                                {formatAction(record.action)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-navy font-bold">
                                                <Cpu size={14} className="text-cyan" />
                                                {record.tokens.toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {renderDetails(record.details)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-between items-center text-xs text-slate-400 font-medium">
                    <span>Hiển thị 50 hoạt động gần nhất</span>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg transition-colors">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UsageHistoryModal;
