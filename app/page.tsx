'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';
import {
    Search, Download, Car, DollarSign, Calendar as CalendarIcon, TrendingUp, Users, Filter, X, Pencil, Trash2, Save
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

export default function Dashboard() {
    const [washes, setWashes] = useState<Wash[]>([]);
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

    // Derived lists for filter options
    const uniqueServices = useMemo(() => Array.from(new Set(washes.map(w => w.parsedService).filter(Boolean))), [washes]);
    const uniqueEmployees = useMemo(() => Array.from(new Set(washes.map(w => w.senderName).filter(Boolean))), [washes]);

    useEffect(() => {
        fetchWashes();
    }, []);

    useEffect(() => {
        filterData();
    }, [washes, searchTerm, dateRange, selectedServices, selectedEmployees]);

    const fetchWashes = async () => {
        try {
            const res = await fetch('/api/washes');
            const data = await res.json();
            setWashes(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching washes:', error);
            setLoading(false);
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
                        Mars Car Wash
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
        </div >
    );
}
