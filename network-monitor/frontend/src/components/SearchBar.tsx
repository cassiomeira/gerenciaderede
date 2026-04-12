import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, User, Hash, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { apiFetch } from '../services/api';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debouncing search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setIsSearching(true);
        try {
          const res = await apiFetch(`/api/clients/search?q=${query}`);
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(true);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/client/${query.trim()}`);
    setShowDropdown(false);
  };

  const selectClient = (identifier: string) => {
    navigate(`/client/${identifier}`);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      <form onSubmit={handleSearch}>
        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
            placeholder="Buscar por Nome, MAC ou Login..."
            className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl py-3 pl-12 pr-4 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 dark:focus:border-blue-400/50 transition-all duration-300 shadow-sm group-hover:shadow-md"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
            {isSearching ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </div>
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Sugestões Encontradas
            </div>
            {suggestions.map((client, index) => (
              <button
                key={index}
                onClick={() => selectClient(client.login)}
                className="w-full flex items-center p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3 group-hover:scale-110 transition-transform">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {client.name}
                  </div>
                  <div className="flex items-center text-xs text-gray-500 space-x-3">
                    <span className="flex items-center">
                      <Hash className="w-3 h-3 mr-1" />
                      {client.login}
                    </span>
                    <span className="flex items-center">
                      <Globe className="w-3 h-3 mr-1" />
                      {client.mac}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showDropdown && suggestions.length === 0 && query.length >= 2 && !isSearching && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-4 text-center text-sm text-gray-500 z-[100]">
          Nenhum cliente sincronizado com este nome.
          <div className="text-xs mt-1 text-gray-400">Tente buscar por LOGIN ou MAC completo.</div>
        </div>
      )}
    </div>
  );
}

