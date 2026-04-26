'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Download, Car, DollarSign, Calendar as CalendarIcon, TrendingUp, Users, Filter, X, Pencil, Trash2, Save, Clock, ChevronLeft, ChevronRight, Building2, Plus, Minus
} from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import 'react-day-picker/dist/style.css';

interface DealerService {
    name: string;
    price: number;
}

interface DealerWashEntry {
    id: number;
    price: number;
    serviceName: string;
    comments: string | null;
    senderName: string;
    createdAt: string;
}

interface DealerBatchEntry {
    id: number;
    openedAt: string;
    paidAt: string | null;
    status: string;
    washes: DealerWashEntry[];
}

interface Dealer {
    id: number;
    name: string;
    services: DealerService[];
    isActive: boolean;
    createdAt: string;
    batches: DealerBatchEntry[];
}

interface Wash {
    id: number;
    originalMessage: string;
    parsedCar: string;
    parsedPrice: number;
    parsedService: string;
    senderName: string;
    senderId: string;
    createdAt: string;
}

interface User {
    id: number;
    telegramId: string;
    username: string;
    role: string;
    createdAt: string;
}

interface TimeEntry {
    id: number;
    userId: number;
    user: { username: string; telegramId: string };
    checkIn: string;
    checkOut: string | null;
    breakHours: number;
    totalHours: number | null;
    createdAt: string;
}

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState<'washes' | 'team' | 'timesheets' | 'dealers'>('washes');
    const [washes, setWashes] = useState<Wash[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [filteredWashes, setFilteredWashes] = useState<Wash[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Advanced Filters State
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
    const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());

    // Edit State
    const [editingWash, setEditingWash] = useState<Wash | null>(null);
    const [editForm, setEditForm] = useState({ carType: '', service: '', price: '' });

    // Shift Edit State
    const [editingShift, setEditingShift] = useState<TimeEntry | null>(null);
    const [editShiftForm, setEditShiftForm] = useState({
        date: '',
        checkInTime: '',
        checkOutTime: '',
        breakHours: '0',
    });

    // Time Entry State
    const [showAddShiftModal, setShowAddShiftModal] = useState(false);
    const [addShiftForm, setAddShiftForm] = useState({
        userId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        checkInTime: '09:30',
        checkOutTime: '18:00',
        breakHours: '0',
    });

    // Team State
    const [inviteLink, setInviteLink] = useState('');
    const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

    // Dealers State
    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [showAddDealerModal, setShowAddDealerModal] = useState(false);
    const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());
    const [dealerForm, setDealerForm] = useState({
        name: '',
        services: [{ name: '', price: '' }]
    });

    // Timesheets week navigation (0 = current week, -1 = last week, etc.)
    const [weekOffset, setWeekOffset] = useState(0);

    // Pay week modal
    const [payModal, setPayModal] = useState<{ employeeName: string; totalHours: number } | null>(null);
    const [payRate, setPayRate] = useState('');

    // Derived lists for filter options
    const uniqueServices = useMemo(() => Array.from(new Set(washes.map(w => w.parsedService).filter(Boolean))), [washes]);
    const uniqueEmployees = useMemo(() => Array.from(new Set(washes.map(w => w.senderName).filter(Boolean))), [washes]);

    // Week range for timesheets (Monday-start)
    const weekStart = useMemo(() => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 6 }), [weekOffset]);
    const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 6 }), [weekStart]);
    const weekEntries = useMemo(() =>
        timeEntries.filter(t => {
            if (!t.checkIn) return false;
            return isWithinInterval(new Date(t.checkIn), { start: weekStart, end: weekEnd });
        }),
        [timeEntries, weekStart, weekEnd]
    );

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchWashes(), fetchUsers(), fetchTimeEntries(), fetchDealers()]);
            setLoading(false);
        };
        loadData();
    }, []);

    useEffect(() => {
        filterData();
    }, [washes, searchTerm, dateRange, selectedServices, selectedEmployees]);

    const fetchWashes = async () => {
        try {
            const res = await fetch('/api/washes');
            const data = await res.json();
            setWashes(data);
        } catch (error) {
            console.error('Error fetching washes:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            if (Array.isArray(data)) {
                setUsers(data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const generateInvite = async () => {
        setIsGeneratingInvite(true);
        setInviteLink('');
        try {
            const res = await fetch('/api/users', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setInviteLink(data.link);
            } else {
                alert('Failed to generate invite: ' + data.error);
            }
        } catch (error) {
            console.error('Error generating invite:', error);
            alert('An error occurred.');
        } finally {
            setIsGeneratingInvite(false);
        }
    };

    const fetchTimeEntries = async () => {
        try {
            const res = await fetch('/api/time-entries');
            const data = await res.json();
            if (Array.isArray(data)) {
                setTimeEntries(data);
            }
        } catch (error) {
            console.error('Error fetching time entries:', error);
        }
    };

    const fetchDealers = async () => {
        try {
            const res = await fetch('/api/dealers');
            const data = await res.json();
            if (Array.isArray(data)) setDealers(data);
        } catch (error) {
            console.error('Error fetching dealers:', error);
        }
    };

    const createDealer = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const services = dealerForm.services
            .filter(s => s.name.trim() && s.price)
            .map(s => ({ name: s.name.trim(), price: parseFloat(s.price) }));
        if (!dealerForm.name.trim() || services.length === 0) {
            alert('Name and at least one service are required.');
            return;
        }
        try {
            const res = await fetch('/api/dealers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: dealerForm.name.trim(), services }),
            });
            if (res.ok) {
                setShowAddDealerModal(false);
                setDealerForm({ name: '', services: [{ name: '', price: '' }] });
                fetchDealers();
            } else {
                alert('Failed to create dealer.');
            }
        } catch {
            alert('An error occurred.');
        }
    };

    const payBatch = async (dealerId: number) => {
        if (!confirm('Mark current batch as PAID and close it?')) return;
        try {
            const res = await fetch(`/api/dealers/${dealerId}/pay`, { method: 'POST' });
            if (res.ok) {
                fetchDealers();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to pay batch.');
            }
        } catch {
            alert('An error occurred.');
        }
    };

    const deleteDealer = async (id: number) => {
        if (!confirm('Deactivate this dealer? Existing data will be preserved.')) return;
        try {
            const res = await fetch(`/api/dealers/${id}`, { method: 'DELETE' });
            if (res.ok) fetchDealers();
            else alert('Failed to deactivate dealer.');
        } catch {
            alert('An error occurred.');
        }
    };

    const deleteWash = async (id: number) => {
        if (!confirm('Are you sure you want to delete this log?')) return;

        try {
            await fetch(`/api/washes/${id}`, { method: 'DELETE' });
            setWashes(prev => prev.filter(w => w.id !== id));
        } catch (error) {
            console.error('Error deleting wash:', error);
            alert('Failed to delete log');
        }
    };

    const deleteUser = async (id: number) => {
        if (!confirm('Are you sure you want to remove this employee? They will lose access to the bot.')) return;

        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setUsers(users.filter(u => u.id !== id));
            } else {
                alert('Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('An error occurred while deleting.');
        }
    };

    const handleAddShift = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // combine date and times into valid localized ISO strings
        const checkInDateTime = new Date(`${addShiftForm.date}T${addShiftForm.checkInTime}`);
        const checkOutDateTime = addShiftForm.checkOutTime ? new Date(`${addShiftForm.date}T${addShiftForm.checkOutTime}`) : null;

        try {
            const res = await fetch('/api/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: addShiftForm.userId,
                    checkIn: checkInDateTime.toISOString(),
                    checkOut: checkOutDateTime ? checkOutDateTime.toISOString() : null,
                    breakHours: addShiftForm.breakHours || 0,
                }),
            });

            if (res.ok) {
                setShowAddShiftModal(false);
                setAddShiftForm({
                    userId: '',
                    date: format(new Date(), 'yyyy-MM-dd'),
                    checkInTime: '09:30',
                    checkOutTime: '18:00',
                    breakHours: '0',
                });
                fetchTimeEntries();
            } else {
                alert('Failed to add shift.');
            }
        } catch (error) {
            console.error('Error adding shift:', error);
            alert('An error occurred.');
        }
    };

    const deleteTimeEntry = async (id: number) => {
        if (!confirm('Are you sure you want to delete this shift?')) return;

        try {
            const res = await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setTimeEntries(timeEntries.filter(t => t.id !== id));
            } else {
                alert('Failed to delete shift');
            }
        } catch (error) {
            console.error('Error deleting shift:', error);
            alert('An error occurred while deleting.');
        }
    };

    const startEditShift = (entry: TimeEntry) => {
        const checkInDate = new Date(entry.checkIn);
        const checkOutDate = entry.checkOut ? new Date(entry.checkOut) : null;

        setEditingShift(entry);
        setEditShiftForm({
            date: format(checkInDate, 'yyyy-MM-dd'),
            checkInTime: format(checkInDate, 'HH:mm'),
            checkOutTime: checkOutDate ? format(checkOutDate, 'HH:mm') : '',
            breakHours: entry.breakHours.toString(),
        });
    };

    const saveShiftEdit = async () => {
        if (!editingShift) return;

        const checkInDateTime = new Date(`${editShiftForm.date}T${editShiftForm.checkInTime}`);
        const checkOutDateTime = editShiftForm.checkOutTime ? new Date(`${editShiftForm.date}T${editShiftForm.checkOutTime}`) : null;

        try {
            const res = await fetch(`/api/time-entries/${editingShift.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checkIn: checkInDateTime.toISOString(),
                    checkOut: checkOutDateTime ? checkOutDateTime.toISOString() : null,
                    breakHours: editShiftForm.breakHours || 0,
                }),
            });

            if (res.ok) {
                const updated = await res.json();
                setTimeEntries(prev => prev.map(t => t.id === updated.id ? updated : t));
                setEditingShift(null);
            } else {
                alert('Failed to update shift.');
            }
        } catch (error) {
            console.error('Error updating shift:', error);
            alert('An error occurred.');
        }
    };

    const startEdit = (wash: Wash) => {
        setEditingWash(wash);
        setEditForm({
            carType: wash.parsedCar,
            service: wash.parsedService,
            price: wash.parsedPrice.toString()
        });
    };

    const saveEdit = async () => {
        if (!editingWash) return;

        try {
            const res = await fetch(`/api/washes/${editingWash.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });

            if (res.ok) {
                const updated = await res.json();
                setWashes(prev => prev.map(w => w.id === updated.id ? updated : w));
                setEditingWash(null);
            }
        } catch (error) {
            console.error('Error updating wash:', error);
            alert('Failed to update log');
        }
    };

    const filterData = () => {
        let result = [...washes];

        // Text Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(w =>
                w.parsedCar?.toLowerCase().includes(lower) ||
                w.parsedService?.toLowerCase().includes(lower) ||
                w.senderName?.toLowerCase().includes(lower)
            );
        }

        // Date Range Filter
        if (dateRange?.from) {
            const start = startOfDay(dateRange.from);
            const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from); // if only start selected, implied single day

            result = result.filter(w => {
                const washDate = new Date(w.createdAt);
                return isWithinInterval(washDate, { start, end });
            });
        }

        // Service Filter
        if (selectedServices.size > 0) {
            result = result.filter(w => selectedServices.has(w.parsedService));
        }

        // Employee Filter
        if (selectedEmployees.size > 0) {
            result = result.filter(w => selectedEmployees.has(w.senderName));
        }

        setFilteredWashes(result);
    };

    const toggleService = (service: string) => {
        const newSet = new Set(selectedServices);
        if (newSet.has(service)) newSet.delete(service);
        else newSet.add(service);
        setSelectedServices(newSet);
    };

    const toggleEmployee = (emp: string) => {
        const newSet = new Set(selectedEmployees);
        if (newSet.has(emp)) newSet.delete(emp);
        else newSet.add(emp);
        setSelectedEmployees(newSet);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setDateRange(undefined);
        setSelectedServices(new Set());
        setSelectedEmployees(new Set());
    };

    const downloadCSV = () => {
        const headers = ['ID', 'Date', 'Car', 'Service', 'Price', 'Employee', 'Original Message'];
        const rows = filteredWashes.map(w => [
            w.id,
            new Date(w.createdAt).toLocaleDateString(),
            w.parsedCar,
            w.parsedService,
            w.parsedPrice,
            w.senderName,
            `"${w.originalMessage.replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `car-wash-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const totalRevenue = filteredWashes.reduce((sum, w) => sum + (w.parsedPrice || 0), 0);
    const avgPrice = filteredWashes.length > 0 ? totalRevenue / filteredWashes.length : 0;

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-400">Loading Dashboard...</div>;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans selection:bg-blue-500/30">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="bg-blue-600 text-white p-2 text-center text-xs font-bold rounded-lg mb-4">
                    DEPLOYMENT VERIFY: LATEST SYNC (v1.1.1)
                </div>
                <div>
                    <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent tracking-tight">
                        AutoSpa L'Exception
                    </h1>
                    <p className="text-slate-400 mt-1 text-sm font-medium tracking-wide">OPERATIONS TRACKER v1.1.1</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={clearFilters}
                        className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all text-sm font-medium"
                    >
                        Clear Filters
                    </button>
                    <button
                        onClick={downloadCSV}
                        className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-900/20 transition-all font-medium text-sm"
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-6 mb-8 border-b border-slate-800/50">
                <button
                    onClick={() => setActiveTab('washes')}
                    className={`pb-3 text-sm font-semibold tracking-wide transition-all ${activeTab === 'washes'
                        ? 'text-blue-400 border-b-2 border-blue-500'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    WASH LOGS
                </button>
                <button
                    onClick={() => setActiveTab('team')}
                    className={`pb-3 text-sm font-semibold tracking-wide transition-all flex items-center gap-2 ${activeTab === 'team'
                        ? 'text-purple-400 border-b-2 border-purple-500'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    <Users size={16} />
                    TEAM MEMBERS
                </button>
                <button
                    onClick={() => setActiveTab('timesheets')}
                    className={`pb-3 text-sm font-semibold tracking-wide transition-all flex items-center gap-2 ${activeTab === 'timesheets'
                        ? 'text-blue-400 border-b-2 border-blue-500'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    <Clock size={16} />
                    TIMESHEETS
                </button>
                <button
                    onClick={() => setActiveTab('dealers')}
                    className={`pb-3 text-sm font-semibold tracking-wide transition-all flex items-center gap-2 ${activeTab === 'dealers'
                        ? 'text-emerald-400 border-b-2 border-emerald-500'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    <Building2 size={16} />
                    DEALERS
                </button>
            </div>

            {activeTab === 'washes' && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {[
                            { title: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                            { title: 'Total Washes', value: filteredWashes.length, icon: Car, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                            { title: 'Avg Ticket', value: `$${avgPrice.toFixed(2)}`, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                            { title: 'Active Staff', value: new Set(filteredWashes.map(w => w.senderName)).size, icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-colors">
                                <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${stat.color}`}>
                                    <stat.icon size={56} />
                                </div>
                                <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{stat.title}</h3>
                                <p className="text-2xl font-bold mt-1 text-white tracking-tight">{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filters Section */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 mb-8 space-y-4 shadow-xl shadow-black/20">
                        <div className="flex flex-col lg:flex-row gap-4">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search anything..."
                                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-600 text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Date Picker Trigger */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowCalendar(!showCalendar)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium min-w-[240px] justify-between
                                ${dateRange?.from ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}
                            `}
                                >
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon size={16} />
                                        <span>
                                            {dateRange?.from ? (
                                                dateRange.to ?
                                                    `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}` :
                                                    format(dateRange.from, 'MMM d, yyyy')
                                            ) : 'Select Date Range'}
                                        </span>
                                    </div>
                                    {dateRange?.from && <X size={14} className="hover:text-white" onClick={(e) => { e.stopPropagation(); setDateRange(undefined); }} />}
                                </button>

                                {/* Popup Calendar */}
                                {showCalendar && (
                                    <div className="absolute top-full right-0 mt-2 p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50">
                                        <style>{`
                                    .rdp { --rdp-cell-size: 40px; --rdp-accent-color: #3b82f6; --rdp-background-color: #1e293b; margin: 0; }
                                    .rdp-day_selected:not(.rdp-day_outside) { background-color: var(--rdp-accent-color); color: white; }
                                    .rdp-day:hover:not(.rdp-day_selected) { background-color: #334155; }
                                    .rdp-caption_label { color: #e2e8f0; font-weight: 600; }
                                    .rdp-head_cell { color: #94a3b8; }
                                    .rdp-button:hover:not([disabled]) { color: white; }
                                `}</style>
                                        <DayPicker
                                            mode="range"
                                            selected={dateRange}
                                            onSelect={setDateRange}
                                            styles={{
                                                root: { color: '#e2e8f0' }
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Filter Pills */}
                        <div className="flex flex-wrap gap-6 border-t border-slate-800/50 pt-4">
                            <div className="space-y-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Services</span>
                                <div className="flex flex-wrap gap-2">
                                    {uniqueServices.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => toggleService(s)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                                        ${selectedServices.has(s)
                                                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'}
                                    `}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Employees</span>
                                <div className="flex flex-wrap gap-2">
                                    {uniqueEmployees.map(e => (
                                        <button
                                            key={e}
                                            onClick={() => toggleEmployee(e)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                                        ${selectedEmployees.has(e)
                                                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
                                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'}
                                    `}
                                        >
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                                    <tr>
                                        <th className="p-5">Time</th>
                                        <th className="p-5">Car</th>
                                        <th className="p-5">Service</th>
                                        <th className="p-5">Price</th>
                                        <th className="p-5">Employee</th>
                                        <th className="p-5 hidden md:table-cell">Message Preview</th>
                                        <th className="p-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredWashes.map((wash) => (
                                        <tr key={wash.id} className="hover:bg-slate-800/30 transition-colors group">
                                            <td className="p-5 text-slate-400 font-mono text-sm">
                                                {format(new Date(wash.createdAt), 'MMM d, h:mm a')}
                                            </td>
                                            <td className="p-5 font-semibold text-slate-200">{wash.parsedCar}</td>
                                            <td className="p-5">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                                                    {wash.parsedService}
                                                </span>
                                            </td>
                                            <td className="p-5 text-emerald-400 font-bold font-mono tracking-tight">${wash.parsedPrice.toFixed(2)}</td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-2 text-slate-300">
                                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-[10px] border border-slate-700 shadow-inner">
                                                        {wash.senderName[0]}
                                                    </div>
                                                    <span className="text-sm font-medium">{wash.senderName}</span>
                                                </div>
                                            </td>
                                            <td className="p-5 text-slate-600 text-sm hidden md:table-cell italic truncate max-w-[200px] group-hover:text-slate-500 transition-colors">
                                                "{wash.originalMessage}"
                                            </td>
                                            <td className="p-5 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => startEdit(wash)}
                                                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteWash(wash.id)}
                                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredWashes.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Filter size={32} className="opacity-20" />
                                                    <p>No washes found matching your filters.</p>
                                                    <button onClick={clearFilters} className="text-blue-500 hover:underline text-sm">Clear all filters</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'team' && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-semibold text-white">Team Roster</h2>
                            <p className="text-sm text-slate-400 mt-1">Manage bot access for your employees.</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <button
                                onClick={generateInvite}
                                disabled={isGeneratingInvite}
                                className="bg-gradient-to-r flex items-center gap-2 from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-lg disabled:opacity-50"
                            >
                                {isGeneratingInvite ? 'Generating...' : 'Generate Invite Link'}
                            </button>
                            {inviteLink && (
                                <div className="text-xs text-slate-300 mt-1 bg-slate-800 p-2 rounded flex flex-col gap-1 items-end border border-emerald-500/50">
                                    <span>Send this link to the new employee:</span>
                                    <code className="text-emerald-400 font-mono bg-slate-900 p-1 rounded max-w-[250px] truncate block">{inviteLink}</code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(inviteLink);
                                            alert('Link Copied!');
                                        }}
                                        className="text-emerald-500 hover:underline cursor-pointer"
                                    >
                                        Copy Link
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                                <tr>
                                    <th className="p-5">User</th>
                                    <th className="p-5">Telegram ID</th>
                                    <th className="p-5">Joined Date</th>
                                    <th className="p-5">Role</th>
                                    <th className="p-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                                                    {user.username ? user.username[0].toUpperCase() : '?'}
                                                </div>
                                                <span className="font-medium text-slate-200">{user.username}</span>
                                            </div>
                                        </td>
                                        <td className="p-5 text-slate-400 font-mono text-sm">{user.telegramId}</td>
                                        <td className="p-5 text-slate-400 text-sm">{format(new Date(user.createdAt), 'MMM d, yyyy')}</td>
                                        <td className="p-5">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${user.role === 'OWNER'
                                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="p-5 text-right">
                                            {user.role !== 'OWNER' && (
                                                <button
                                                    onClick={() => deleteUser(user.id)}
                                                    className="p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors inline-flex opacity-0 group-hover:opacity-100"
                                                    title="Remove Employee"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-slate-500">
                                            No users found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'timesheets' && (
                <div className="space-y-5">
                    {/* Header */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-semibold text-white">Employee Hours</h2>
                            <p className="text-sm text-slate-400 mt-1">Automated timesheet tracking based on bot check-ins, or manage manually.</p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex bg-slate-800 rounded-lg p-1">
                                <button
                                    onClick={() => setWeekOffset(0)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all ${weekOffset === 0 ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    ACTIVE WEEK
                                </button>
                                <button
                                    onClick={() => { if (weekOffset === 0) setWeekOffset(-1); }}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all ${weekOffset < 0 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    HISTORY
                                </button>
                            </div>
                            <button
                                onClick={() => setShowAddShiftModal(true)}
                                className="flex items-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                            >
                                <CalendarIcon size={14} />
                                Add Manual Shift
                            </button>
                        </div>
                    </div>

                    {/* Week Navigation */}
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={() => setWeekOffset(o => o - 1)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="text-center min-w-[220px]">
                            <p className="text-white font-semibold text-sm">
                                {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
                            </p>
                            <p className={`text-xs font-bold mt-0.5 tracking-wide ${weekOffset === 0 ? 'text-emerald-400' : weekOffset === -1 ? 'text-amber-400' : 'text-blue-400'}`}>
                                {weekOffset === 0 ? '● CURRENT WEEK' : weekOffset === -1 ? '● LAST WEEK' : '● ARCHIVED'}
                            </p>
                        </div>
                        <button
                            onClick={() => setWeekOffset(o => Math.min(o + 1, 0))}
                            disabled={weekOffset >= 0}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 disabled:opacity-25 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'TOTAL HOURS', value: weekEntries.reduce((s, t) => s + (t.totalHours || 0), 0).toFixed(2), color: 'text-blue-400' },
                            { label: 'TOTAL SHIFTS', value: String(weekEntries.length), color: 'text-emerald-400' },
                            { label: 'EMPLOYEES', value: String(new Set(weekEntries.filter(t => t.user).map(t => t.user.username)).size), color: 'text-purple-400' },
                            { label: 'WEEK STATUS', value: weekOffset === 0 ? 'ACTIVE' : weekOffset === -1 ? 'LAST WEEK' : 'ARCHIVED', color: weekOffset === 0 ? 'text-emerald-400' : weekOffset === -1 ? 'text-amber-400' : 'text-slate-300' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Per-Employee Tables */}
                    {Array.from(new Set(weekEntries.filter(t => t.user).map(t => t.user.username))).map(employeeName => {
                        const employeeEntries = weekEntries.filter(t => t.user && t.user.username === employeeName);
                        const totalHours = employeeEntries.reduce((sum, t) => sum + (t.totalHours || 0), 0);

                        return (
                            <div key={employeeName} className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                                <div className="px-5 py-4 flex justify-between items-center bg-slate-800/40 border-b border-slate-700/50">
                                    <h3 className="font-bold text-lg text-white">{employeeName}</h3>
                                    <span className="text-slate-400 text-sm">Total Hours: <strong className="text-blue-400">{totalHours.toFixed(2)}</strong></span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#1a3a5c] text-slate-200 text-xs font-bold uppercase tracking-wider">
                                                <th className="p-3 w-24">Day</th>
                                                <th className="p-3">Check-in</th>
                                                <th className="p-3">Check-out</th>
                                                <th className="p-3">Break</th>
                                                <th className="p-3">Total Hours</th>
                                                <th className="p-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {employeeEntries.map((entry) => {
                                                const checkInDate = new Date(entry.checkIn);
                                                const checkOutDate = entry.checkOut ? new Date(entry.checkOut) : null;
                                                return (
                                                    <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                                                        <td className="p-3">
                                                            <div className="font-semibold text-slate-200 text-sm">{format(checkInDate, 'EEE')}</div>
                                                            <div className="text-slate-600 text-xs">{format(checkInDate, 'MMM d')}</div>
                                                        </td>
                                                        <td className="p-3 text-slate-200 font-mono text-sm">{format(checkInDate, 'H:mm')}</td>
                                                        <td className="p-3 font-mono text-sm">
                                                            {checkOutDate
                                                                ? <span className="text-slate-200">{format(checkOutDate, 'H:mm')}</span>
                                                                : <span className="text-amber-400 text-xs font-bold tracking-wide">● ACTIVE</span>}
                                                        </td>
                                                        <td className="p-3 text-slate-400 text-sm">{entry.breakHours}h</td>
                                                        <td className="p-3 font-bold text-blue-400 text-sm">
                                                            {entry.totalHours ? entry.totalHours.toFixed(2) : '—'}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => startEditShift(entry)}
                                                                    className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                                    title="Edit Shift"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteTimeEntry(entry.id)}
                                                                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                    title="Delete Shift"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-5 py-3 border-t border-slate-800/80 flex justify-end items-center bg-slate-950/30">
                                    {weekOffset <= -2 ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 text-sm">Paid:</span>
                                            <span className="text-emerald-400 font-bold text-lg">${(totalHours * 10).toFixed(2)}</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setPayModal({ employeeName, totalHours });
                                                setPayRate(weekOffset <= -2 ? '10' : '');
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 rounded-lg text-sm font-semibold transition-colors"
                                        >
                                            <DollarSign size={14} />
                                            Pay Week
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {weekEntries.length === 0 && (
                        <div className="text-center p-16 text-slate-500 border border-slate-800 rounded-2xl bg-slate-900/50">
                            <Clock size={36} className="mx-auto mb-3 opacity-20" />
                            <p className="font-medium">No shifts recorded for this week.</p>
                            <p className="text-xs mt-1 text-slate-600">
                                {weekOffset === 0
                                    ? 'Employees need to use /checkin and /checkout.'
                                    : 'No data for this period. Try navigating to a different week.'}
                            </p>
                        </div>
                    )}

                    {/* Weekly Pay Summary */}
                    {weekEntries.length > 0 && (
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                            <div className="px-5 py-4 bg-slate-800/40 border-b border-slate-700/50 flex justify-between items-center">
                                <div>
                                    <h3 className="font-semibold text-slate-200">Weekly Pay Summary</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">{format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}</p>
                                </div>
                                {weekOffset <= -2 && (
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">@ $10.00 / hr</span>
                                )}
                            </div>
                            <div className="p-5 space-y-3">
                                {Array.from(new Set(weekEntries.filter(t => t.user).map(t => t.user.username))).map(name => {
                                    const hrs = weekEntries.filter(t => t.user?.username === name).reduce((s, t) => s + (t.totalHours || 0), 0);
                                    return (
                                        <div key={name} className="flex justify-between items-center text-sm">
                                            <span className="text-slate-400">{name}</span>
                                            <div className="flex items-center gap-6">
                                                <span className="text-slate-500 tabular-nums">{hrs.toFixed(2)} hrs</span>
                                                {weekOffset <= -2
                                                    ? <span className="text-emerald-400 font-semibold tabular-nums w-20 text-right">${(hrs * 10).toFixed(2)}</span>
                                                    : <span className="text-slate-700 w-20 text-right">—</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="border-t border-slate-700/50 pt-3 mt-1 flex justify-between items-center">
                                    <span className="text-white font-bold">Total</span>
                                    <div className="flex items-center gap-6">
                                        <span className="text-blue-400 font-bold tabular-nums">
                                            {weekEntries.reduce((s, t) => s + (t.totalHours || 0), 0).toFixed(2)} hrs
                                        </span>
                                        {weekOffset <= -2
                                            ? <span className="text-emerald-400 font-extrabold text-xl tabular-nums w-20 text-right">
                                                ${(weekEntries.reduce((s, t) => s + (t.totalHours || 0), 0) * 10).toFixed(2)}
                                              </span>
                                            : <span className="text-slate-500 text-sm w-20 text-right">In progress</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'dealers' && (
                <div className="space-y-5">
                    {/* Header */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-semibold text-white">Dealer Management</h2>
                            <p className="text-sm text-slate-400 mt-1">Track dealer washes per batch. One open batch per dealer at a time.</p>
                        </div>
                        <button
                            onClick={() => setShowAddDealerModal(true)}
                            className="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                            <Plus size={16} />
                            Add Dealer
                        </button>
                    </div>

                    {dealers.length === 0 && (
                        <div className="text-center p-16 text-slate-500 border border-slate-800 rounded-2xl bg-slate-900/50">
                            <Building2 size={36} className="mx-auto mb-3 opacity-20" />
                            <p className="font-medium">No dealers configured yet.</p>
                            <p className="text-xs mt-1 text-slate-600">Click &quot;Add Dealer&quot; to get started.</p>
                        </div>
                    )}

                    {dealers.map(dealer => {
                        const openBatch = dealer.batches.find(b => b.status === 'OPEN');
                        const paidBatches = dealer.batches.filter(b => b.status === 'PAID');
                        const openTotal = openBatch ? openBatch.washes.reduce((s, w) => s + w.price, 0) : 0;

                        return (
                            <div key={dealer.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                                {/* Dealer Header */}
                                <div className="px-5 py-4 flex justify-between items-center bg-slate-800/40 border-b border-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <Building2 size={20} className="text-emerald-400" />
                                        <h3 className="font-bold text-lg text-white">{dealer.name}</h3>
                                        <span className="text-xs text-slate-500">{dealer.services.length} service{dealer.services.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {openBatch && (
                                            <button
                                                onClick={() => payBatch(dealer.id)}
                                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 rounded-lg text-sm font-semibold transition-colors"
                                            >
                                                <DollarSign size={14} />
                                                Pay Batch (${openTotal.toFixed(2)})
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteDealer(dealer.id)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Deactivate Dealer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Services chips */}
                                <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-slate-800/50 bg-slate-950/20">
                                    {dealer.services.map((svc, i) => (
                                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300">
                                            {svc.name}
                                            <span className="text-emerald-400 font-semibold">${svc.price}</span>
                                        </span>
                                    ))}
                                </div>

                                {/* Open Batch */}
                                {openBatch ? (
                                    <div>
                                        <div className="px-5 py-3 flex justify-between items-center border-b border-slate-800/30 bg-emerald-900/5">
                                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                                ● Open Batch — since {format(new Date(openBatch.openedAt), 'MMM d, yyyy')}
                                            </span>
                                            <span className="text-emerald-400 font-bold text-sm">
                                                {openBatch.washes.length} wash{openBatch.washes.length !== 1 ? 'es' : ''} · Total: ${openTotal.toFixed(2)}
                                            </span>
                                        </div>
                                        {openBatch.washes.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-slate-950/40 text-slate-500 text-xs uppercase tracking-wider">
                                                            <th className="px-5 py-2">Date</th>
                                                            <th className="px-5 py-2">Service</th>
                                                            <th className="px-5 py-2">Employee</th>
                                                            <th className="px-5 py-2">Comments</th>
                                                            <th className="px-5 py-2 text-right">Price</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800/40">
                                                        {openBatch.washes.map(wash => (
                                                            <tr key={wash.id} className="hover:bg-slate-800/20 transition-colors">
                                                                <td className="px-5 py-2.5 text-slate-400 text-sm">{format(new Date(wash.createdAt), 'MMM d, h:mm a')}</td>
                                                                <td className="px-5 py-2.5 text-slate-200 font-medium text-sm">{wash.serviceName}</td>
                                                                <td className="px-5 py-2.5 text-slate-400 text-sm">{wash.senderName}</td>
                                                                <td className="px-5 py-2.5 text-slate-500 text-sm italic">{wash.comments || '—'}</td>
                                                                <td className="px-5 py-2.5 text-emerald-400 font-bold text-sm text-right">${wash.price.toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="px-5 py-8 text-center text-slate-600 text-sm">No washes logged in this batch yet.</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="px-5 py-8 text-center text-slate-600 text-sm">
                                        No open batch. A new batch opens automatically when the next wash is logged via the bot.
                                    </div>
                                )}

                                {/* Past Batches */}
                                {paidBatches.length > 0 && (
                                    <div className="border-t border-slate-800">
                                        <button
                                            onClick={() => {
                                                const newSet = new Set(expandedBatches);
                                                if (newSet.has(dealer.id)) newSet.delete(dealer.id);
                                                else newSet.add(dealer.id);
                                                setExpandedBatches(newSet);
                                            }}
                                            className="w-full px-5 py-3 flex justify-between items-center text-slate-500 hover:text-slate-300 hover:bg-slate-800/20 transition-colors text-sm"
                                        >
                                            <span className="font-medium">{paidBatches.length} paid batch{paidBatches.length !== 1 ? 'es' : ''}</span>
                                            <ChevronRight size={16} className={`transition-transform ${expandedBatches.has(dealer.id) ? 'rotate-90' : ''}`} />
                                        </button>
                                        {expandedBatches.has(dealer.id) && (
                                            <div className="space-y-3 px-5 pb-4">
                                                {paidBatches.map(batch => {
                                                    const batchTotal = batch.washes.reduce((s, w) => s + w.price, 0);
                                                    return (
                                                        <div key={batch.id} className="bg-slate-950/40 border border-slate-800/50 rounded-xl overflow-hidden">
                                                            <div className="px-4 py-2.5 flex justify-between items-center border-b border-slate-800/30">
                                                                <span className="text-xs text-slate-500">
                                                                    {format(new Date(batch.openedAt), 'MMM d')} – {batch.paidAt ? format(new Date(batch.paidAt), 'MMM d, yyyy') : ''}
                                                                </span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs text-slate-500">{batch.washes.length} wash{batch.washes.length !== 1 ? 'es' : ''}</span>
                                                                    <span className="text-emerald-400 font-bold text-sm">${batchTotal.toFixed(2)}</span>
                                                                    <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">PAID</span>
                                                                </div>
                                                            </div>
                                                            <div className="divide-y divide-slate-800/30">
                                                                {batch.washes.map(w => (
                                                                    <div key={w.id} className="px-4 py-2 flex justify-between items-center text-xs">
                                                                        <span className="text-slate-500">{format(new Date(w.createdAt), 'MMM d')}</span>
                                                                        <span className="text-slate-300">{w.serviceName}</span>
                                                                        <span className="text-slate-500">{w.senderName}</span>
                                                                        <span className="text-emerald-400 font-semibold">${w.price.toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit Modal */}
            {
                editingWash && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Edit Log #{editingWash.id}</h3>
                                <button onClick={() => setEditingWash(null)} className="text-slate-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Car Type</label>
                                    <input
                                        type="text"
                                        value={editForm.carType}
                                        onChange={e => setEditForm(prev => ({ ...prev, carType: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Service & Add-ons</label>
                                    <input
                                        type="text"
                                        value={editForm.service}
                                        onChange={e => setEditForm(prev => ({ ...prev, service: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Price ($)</label>
                                    <input
                                        type="number"
                                        value={editForm.price}
                                        onChange={e => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setEditingWash(null)}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveEdit}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Save size={18} />
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Pay Week Modal */}
            {payModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Pay Week</h3>
                            <button onClick={() => setPayModal(null)} className="text-slate-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2.5 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Employee</span>
                                    <span className="text-white font-semibold">{payModal.employeeName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Period</span>
                                    <span className="text-slate-300">{format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-700/50 pt-2.5">
                                    <span className="text-slate-400">Hours Worked</span>
                                    <span className="text-blue-400 font-bold text-base">{payModal.totalHours.toFixed(2)} hrs</span>
                                </div>
                            </div>

                            {/* Rate — fixed for fully archived (2+ weeks back), editable otherwise */}
                            {weekOffset <= -2 ? (
                                <div className="flex justify-between items-center bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-sm">
                                    <span className="text-slate-400">Rate Applied</span>
                                    <span className="text-slate-200 font-semibold">$10.00 / hr <span className="text-slate-600 font-normal text-xs ml-1">(archived rate)</span></span>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Hourly Rate ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={payRate}
                                        onChange={e => setPayRate(e.target.value)}
                                        placeholder="e.g. 15.00"
                                        autoFocus
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/30 outline-none transition-all"
                                    />
                                </div>
                            )}

                            {/* Result */}
                            {parseFloat(payRate) > 0 && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 text-center">
                                    <p className="text-xs text-emerald-500 uppercase tracking-wider font-bold mb-2">Total to Pay</p>
                                    <p className="text-4xl font-extrabold text-emerald-400 tracking-tight">
                                        ${(payModal.totalHours * parseFloat(payRate)).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">
                                        {payModal.totalHours.toFixed(2)} hrs × ${parseFloat(payRate).toFixed(2)}/hr
                                    </p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setPayModal(null)}
                            className="w-full mt-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors text-slate-300"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Add Shift Modal */}
            {showAddShiftModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Add Manual Shift</h3>
                            <button onClick={() => setShowAddShiftModal(false)} className="text-slate-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddShift} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Employee</label>
                                <select
                                    value={addShiftForm.userId}
                                    onChange={e => setAddShiftForm(prev => ({ ...prev, userId: e.target.value }))}
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                >
                                    <option value="">Select employee...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={addShiftForm.date}
                                    onChange={e => setAddShiftForm(prev => ({ ...prev, date: e.target.value }))}
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Check-in</label>
                                    <input
                                        type="time"
                                        value={addShiftForm.checkInTime}
                                        onChange={e => setAddShiftForm(prev => ({ ...prev, checkInTime: e.target.value }))}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Check-out</label>
                                    <input
                                        type="time"
                                        value={addShiftForm.checkOutTime}
                                        onChange={e => setAddShiftForm(prev => ({ ...prev, checkOutTime: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Break (Hours)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={addShiftForm.breakHours}
                                        onChange={e => setAddShiftForm(prev => ({ ...prev, breakHours: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddShiftModal(false)}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Save size={18} />
                                    Add Shift
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Shift Modal */}
            {
                editingShift && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Edit Shift for {editingShift.user.username}</h3>
                                <button onClick={() => setEditingShift(null)} className="text-slate-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={editShiftForm.date}
                                        onChange={e => setEditShiftForm(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Check-in</label>
                                        <input
                                            type="time"
                                            value={editShiftForm.checkInTime}
                                            onChange={e => setEditShiftForm(prev => ({ ...prev, checkInTime: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Check-out</label>
                                        <input
                                            type="time"
                                            value={editShiftForm.checkOutTime}
                                            onChange={e => setEditShiftForm(prev => ({ ...prev, checkOutTime: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Break (Hours)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={editShiftForm.breakHours}
                                            onChange={e => setEditShiftForm(prev => ({ ...prev, breakHours: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setEditingShift(null)}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveShiftEdit}
                                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Save size={18} />
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Add Dealer Modal */}
            {showAddDealerModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Add New Dealer</h3>
                            <button onClick={() => setShowAddDealerModal(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={createDealer} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Dealer Name</label>
                                <input
                                    type="text"
                                    value={dealerForm.name}
                                    onChange={e => setDealerForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. AutoZone Fleet"
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-medium text-slate-400">Services &amp; Prices</label>
                                    <button
                                        type="button"
                                        onClick={() => setDealerForm(prev => ({ ...prev, services: [...prev.services, { name: '', price: '' }] }))}
                                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                                    >
                                        <Plus size={14} />
                                        Add Row
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {dealerForm.services.map((svc, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                placeholder="Service name (e.g. Sedan)"
                                                value={svc.name}
                                                onChange={e => {
                                                    const updated = [...dealerForm.services];
                                                    updated[i] = { ...updated[i], name: e.target.value };
                                                    setDealerForm(prev => ({ ...prev, services: updated }));
                                                }}
                                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Price $"
                                                min="0"
                                                step="0.01"
                                                value={svc.price}
                                                onChange={e => {
                                                    const updated = [...dealerForm.services];
                                                    updated[i] = { ...updated[i], price: e.target.value };
                                                    setDealerForm(prev => ({ ...prev, services: updated }));
                                                }}
                                                className="w-24 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none"
                                            />
                                            {dealerForm.services.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDealerForm(prev => ({ ...prev, services: prev.services.filter((_, idx) => idx !== i) }))}
                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddDealerModal(false)}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Save size={18} />
                                    Create Dealer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );
}
