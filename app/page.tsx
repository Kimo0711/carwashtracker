'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';
import {
    Search, Download, Car, DollarSign, Calendar as CalendarIcon, TrendingUp, Users, Filter, X, Pencil, Trash2, Save, Clock, RefreshCw, UserPlus
} from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import 'react-day-picker/dist/style.css';

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
    tips: number;
    createdAt: string;
}

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState<'washes' | 'team' | 'timesheets'>('washes');
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
        tips: '0'
    });

    // Time Entry State
    const [showAddShiftModal, setShowAddShiftModal] = useState(false);
    const [manualEmployeeName, setManualEmployeeName] = useState('');
    const [isCreatingManualEmployee, setIsCreatingManualEmployee] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [addShiftForm, setAddShiftForm] = useState({
        userId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        checkInTime: '09:00',
        checkOutTime: '17:00',
        breakHours: '0',
        tips: '0'
    });

    // Team State
    const [inviteLink, setInviteLink] = useState('');
    const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

    // Derived lists for filter options
    const uniqueServices = useMemo(() => Array.from(new Set(washes.map(w => w.parsedService).filter(Boolean))), [washes]);
    const uniqueEmployees = useMemo(() => Array.from(new Set(washes.map(w => w.senderName).filter(Boolean))), [washes]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchWashes(), fetchUsers(), fetchTimeEntries()]);
            setLoading(false);
        };
        loadData();
    }, []);

    useEffect(() => {
        fetchTimeEntries();
    }, [showArchived]);

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
            const res = await fetch(`/api/time-entries?archived=${showArchived}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setTimeEntries(data);
            }
        } catch (error) {
            console.error('Error fetching time entries:', error);
        }
    };

    const archiveWeek = async () => {
        if (!confirm('Are you sure you want to archive all current entries? This will start a fresh week.')) return;

        try {
            const res = await fetch('/api/time-entries', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'archive_all' })
            });

            if (res.ok) {
                alert('Week Archived Successfully!');
                fetchTimeEntries();
            } else {
                alert('Archive failed');
            }
        } catch (error) {
            console.error('Archive error:', error);
            alert('An error occurred.');
        }
    };

    const addManualEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualEmployeeName) return;

        setIsCreatingManualEmployee(true);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: manualEmployeeName,
                    mode: 'manual'
                })
            });

            if (res.ok) {
                const newUser = await res.json();
                setUsers(prev => [...prev, newUser]);
                setManualEmployeeName('');
                alert(`Employee ${newUser.username} added successfully!`);
            } else {
                alert('Failed to add employee');
            }
        } catch (error) {
            console.error('Error adding employee:', error);
            alert('An error occurred.');
        } finally {
            setIsCreatingManualEmployee(false);
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

    const syncBot = async () => {
        try {
            const res = await fetch('/api/telegram/webhook');
            const data = await res.json();
            if (data.success) {
                alert('Bot Connection Synced Successfully!');
            } else {
                alert('Sync failed: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Sync error:', err);
            alert('Error syncing bot. See console.');
        }
    };

    const handleAddShift = async (e: React.FormEvent) => {
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
                    tips: addShiftForm.tips || 0,
                }),
            });

            if (res.ok) {
                setShowAddShiftModal(false);
                setAddShiftForm({
                    userId: '',
                    date: format(new Date(), 'yyyy-MM-dd'),
                    checkInTime: '09:00',
                    checkOutTime: '17:00',
                    breakHours: '0',
                    tips: '0'
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
            tips: entry.tips.toString()
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
                    tips: editShiftForm.tips || 0,
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
                <div>
                    <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent tracking-tight">
                        AutoSpa L'Exception
                    </h1>
                    <p className="text-slate-400 mt-1 text-sm font-medium tracking-wide">OPERATIONS TRACKER</p>
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
                        <div className="flex flex-col items-end gap-3">
                            <form onSubmit={addManualEmployee} className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Employee Name..."
                                    value={manualEmployeeName}
                                    onChange={(e) => setManualEmployeeName(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none w-48"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isCreatingManualEmployee}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    <UserPlus size={16} />
                                    {isCreatingManualEmployee ? 'Adding...' : 'Add Manually'}
                                </button>
                            </form>
                            <div className="flex gap-2">
                                <button
                                    onClick={syncBot}
                                    className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors border border-slate-800 px-3 py-1.5 rounded-lg bg-slate-900/50"
                                    title="Repair bot connection (required if address changes)"
                                >
                                    <RefreshCw size={14} />
                                    Sync Bot Connection
                                </button>
                                <button
                                    onClick={generateInvite}
                                    disabled={isGeneratingInvite}
                                    className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors border border-slate-800 px-3 py-1.5 rounded-lg bg-slate-900/50"
                                >
                                    {isGeneratingInvite ? 'Generating...' : 'Bot Invite Link'}
                                </button>
                            </div>
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
                                        <td className="p-5 text-slate-400 font-mono text-sm">
                                            {user.telegramId || <span className="text-slate-600 italic">Manual Only</span>}
                                        </td>
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
                <div className="space-y-8">
                    {/* Header */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-semibold text-white">Employee Hours</h2>
                            <p className="text-sm text-slate-400 mt-1">Automated timesheet tracking based on bot check-ins, or manage manually.</p>
                        </div>
                        <div className="flex gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                            <button
                                onClick={() => setShowArchived(false)}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!showArchived ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                ACTIVE WEEK
                            </button>
                            <button
                                onClick={() => setShowArchived(true)}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${showArchived ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                HISTORY
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowAddShiftModal(true)}
                                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold transition-all border border-slate-700"
                            >
                                <Clock size={16} />
                                Add Manual Shift
                            </button>
                            {!showArchived && timeEntries.length > 0 && (
                                <button
                                    onClick={archiveWeek}
                                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg active:scale-95"
                                >
                                    <Save size={16} />
                                    Archive This Week
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Total Hours</p>
                            <p className="text-2xl font-bold text-blue-400">{timeEntries.reduce((sum, t) => sum + (t.totalHours || 0), 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Total Tips</p>
                            <p className="text-2xl font-bold text-emerald-400">${timeEntries.reduce((sum, t) => sum + (t.tips || 0), 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Employees</p>
                            <p className="text-2xl font-bold text-indigo-400">{new Set(timeEntries.filter(t => t.user).map(t => t.user.username)).size}</p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Week Status</p>
                            <p className="text-2xl font-bold text-slate-300">{showArchived ? 'ARCHIVED' : 'ACTIVE'}</p>
                        </div>
                    </div>

                    {/* Employee Tables */}
                    {Array.from(new Set(timeEntries.filter(t => t.user).map(t => t.user.username))).map(employeeName => {
                        const employeeEntries = timeEntries.filter(t => t.user && t.user.username === employeeName);
                        const totalHours = employeeEntries.reduce((sum, t) => sum + (t.totalHours || 0), 0);
                        const totalTips = employeeEntries.reduce((sum, t) => sum + (t.tips || 0), 0);

                        return (
                            <div key={employeeName} className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-4 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-slate-200">{employeeName}</h3>
                                    <div className="flex gap-4 text-sm">
                                        <span className="text-slate-400">Total Hours: <strong className="text-blue-400">{totalHours.toFixed(2)}</strong></span>
                                        <span className="text-slate-400">Total Tips: <strong className="text-emerald-400">${totalTips.toFixed(2)}</strong></span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse bg-slate-950/50">
                                        <thead className="bg-[#5b9bd5]/80 text-white text-xs font-bold uppercase tracking-wider">
                                            <tr>
                                                <th className="p-3 border-r border-[#41709b]/50 w-32">Day of the week</th>
                                                <th className="p-3 border-r border-[#41709b]/50">Check-in time</th>
                                                <th className="p-3 border-r border-[#41709b]/50">Check-out time</th>
                                                <th className="p-3 border-r border-[#41709b]/50">Break hours</th>
                                                <th className="p-3 border-r border-[#41709b]/50">Total hours</th>
                                                <th className="p-3 border-r border-[#41709b]/50">Tips</th>
                                                <th className="p-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {employeeEntries.map((entry) => {
                                                const checkInDate = new Date(entry.checkIn);
                                                const checkOutDate = entry.checkOut ? new Date(entry.checkOut) : null;

                                                return (
                                                    <tr key={entry.id} className="hover:bg-slate-800/50 transition-colors">
                                                        <td className="p-3 border-r border-slate-800/50 text-slate-300 font-medium">
                                                            {format(checkInDate, 'EEE')}
                                                        </td>
                                                        <td className="p-3 border-r border-slate-800/50 text-slate-300">
                                                            {format(checkInDate, 'H:mm')}
                                                        </td>
                                                        <td className="p-3 border-r border-slate-800/50 text-slate-300">
                                                            {checkOutDate ? format(checkOutDate, 'H:mm') : <span className="text-amber-400 italic">Active</span>}
                                                        </td>
                                                        <td className="p-3 border-r border-slate-800/50 text-slate-300">
                                                            {entry.breakHours}
                                                        </td>
                                                        <td className="p-3 border-r border-slate-800/50 font-bold text-blue-400">
                                                            {entry.totalHours ? entry.totalHours.toFixed(2) : '-'}
                                                        </td>
                                                        <td className="p-3 border-r border-slate-800/50 text-emerald-400 font-medium">
                                                            {entry.tips > 0 ? `$${entry.tips.toFixed(2)}` : ''}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex items-center justify-end gap-2">
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
                                            {employeeEntries.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="p-6 text-center text-slate-500">
                                                        No shifts found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}

                    {timeEntries.length === 0 && (
                        <div className="text-center p-12 text-slate-500 border border-slate-800 rounded-2xl bg-slate-900/50">
                            No timesheet data available. Employees need to use `/checkin` and `/checkout`.
                        </div>
                    )}
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
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Tips ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editShiftForm.tips}
                                            onChange={e => setEditShiftForm(prev => ({ ...prev, tips: e.target.value }))}
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
            {/* Add Shift Modal */}
            {showAddShiftModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <form onSubmit={handleAddShift} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Add Manual Shift</h3>
                            <button type="button" onClick={() => setShowAddShiftModal(false)} className="text-slate-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Employee</label>
                                <select
                                    required
                                    value={addShiftForm.userId}
                                    onChange={e => setAddShiftForm(prev => ({ ...prev, userId: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                >
                                    <option value="">Select Employee...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.username}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                                <input
                                    type="date"
                                    required
                                    value={addShiftForm.date}
                                    onChange={e => setAddShiftForm(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Check-in</label>
                                    <input
                                        type="time"
                                        required
                                        value={addShiftForm.checkInTime}
                                        onChange={e => setAddShiftForm(prev => ({ ...prev, checkInTime: e.target.value }))}
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
                                        value={addShiftForm.breakHours}
                                        onChange={e => setAddShiftForm(prev => ({ ...prev, breakHours: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Tips ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={addShiftForm.tips}
                                        onChange={e => setAddShiftForm(prev => ({ ...prev, tips: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                type="button"
                                onClick={() => setShowAddShiftModal(false)}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-white"
                            >
                                <Save size={18} />
                                Add Shift
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div >
    );
}
