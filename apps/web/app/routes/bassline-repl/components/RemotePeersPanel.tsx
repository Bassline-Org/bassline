import { Globe, Wifi, WifiOff, X, Zap } from "lucide-react";
import { useState } from "react";

export interface RemotePeer {
    url: string;
    status: "connected" | "disconnected" | "error";
    connectedAt?: number;
    name?: string;
}

interface RemotePeersPanelProps {
    peers: RemotePeer[];
    onConnect?: (url: string) => Promise<void>;
    onDisconnect?: (url: string) => Promise<void>;
    onPing?: (url: string) => Promise<void>;
}

export function RemotePeersPanel({
    peers,
    onConnect,
    onDisconnect,
    onPing,
}: RemotePeersPanelProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [connectUrl, setConnectUrl] = useState("ws://localhost:8080");
    const [showConnectForm, setShowConnectForm] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const connectedPeers = peers.filter((p) => p.status === "connected");

    const formatUptime = (connectedAt: number) => {
        const elapsed = Date.now() - connectedAt;
        if (elapsed < 60000) return `${Math.floor(elapsed / 1000)}s`;
        if (elapsed < 3600000) return `${Math.floor(elapsed / 60000)}m`;
        return `${Math.floor(elapsed / 3600000)}h`;
    };

    const handleConnect = async () => {
        if (!onConnect || !connectUrl.trim()) return;
        setIsConnecting(true);
        try {
            await onConnect(connectUrl);
            setShowConnectForm(false);
            setConnectUrl("ws://localhost:8080");
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="border-b bg-white">
            {/* Header */}
            <div
                className="px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:bg-slate-50"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-semibold text-sm">Remote Peers</h3>
                    {connectedPeers.length > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full">
                            {connectedPeers.length} connected
                        </span>
                    )}
                </div>
                <button className="text-slate-400 hover:text-slate-600">
                    {isCollapsed ? "▶" : "▼"}
                </button>
            </div>

            {!isCollapsed && (
                <>
                    {/* Quick connect button */}
                    <div className="px-4 py-2 border-b bg-slate-50">
                        {showConnectForm ? (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={connectUrl}
                                    onChange={(e) => setConnectUrl(e.target.value)}
                                    placeholder="ws://localhost:8080"
                                    className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleConnect();
                                        if (e.key === "Escape") setShowConnectForm(false);
                                    }}
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleConnect}
                                        disabled={isConnecting || !connectUrl.trim()}
                                        className="flex-1 text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        {isConnecting ? "Connecting..." : "Connect"}
                                    </button>
                                    <button
                                        onClick={() => setShowConnectForm(false)}
                                        className="text-xs px-3 py-1 border rounded hover:bg-white"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowConnectForm(true)}
                                className="w-full text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            >
                                + Connect to Daemon
                            </button>
                        )}
                    </div>

                    {/* Peer list */}
                    <div className="max-h-96 overflow-auto">
                        {peers.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-slate-500">
                                <Globe className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                <p className="mb-2">No remote peers connected</p>
                                <p className="text-xs text-slate-400">
                                    Start the daemon and click "Connect to Daemon" above
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {peers.map((peer) => (
                                    <PeerItem
                                        key={peer.url}
                                        peer={peer}
                                        formatUptime={formatUptime}
                                        onDisconnect={onDisconnect}
                                        onPing={onPing}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function PeerItem({
    peer,
    formatUptime,
    onDisconnect,
    onPing,
}: {
    peer: RemotePeer;
    formatUptime: (t: number) => string;
    onDisconnect?: (url: string) => Promise<void>;
    onPing?: (url: string) => Promise<void>;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPinging, setIsPinging] = useState(false);

    const getStatusIcon = () => {
        switch (peer.status) {
            case "connected":
                return <Wifi className="w-4 h-4 text-emerald-600" />;
            case "disconnected":
                return <WifiOff className="w-4 h-4 text-slate-400" />;
            case "error":
                return <WifiOff className="w-4 h-4 text-red-600" />;
        }
    };

    const getStatusBadge = () => {
        switch (peer.status) {
            case "connected":
                return (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded border border-emerald-300">
                        Connected
                    </span>
                );
            case "disconnected":
                return (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded border border-slate-300">
                        Disconnected
                    </span>
                );
            case "error":
                return (
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded border border-red-300">
                        Error
                    </span>
                );
        }
    };

    const handlePing = async () => {
        if (!onPing) return;
        setIsPinging(true);
        try {
            await onPing(peer.url);
        } finally {
            setIsPinging(false);
        }
    };

    const handleDisconnect = async () => {
        if (!onDisconnect) return;
        await onDisconnect(peer.url);
    };

    return (
        <div
            className="px-4 py-3 hover:bg-slate-50 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon()}
                        <span className="text-sm font-medium text-slate-700 truncate">
                            {peer.name || "Daemon"}
                        </span>
                    </div>
                    <p className="text-xs font-mono text-slate-500 truncate">{peer.url}</p>
                    <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge()}
                        {peer.status === "connected" && peer.connectedAt && (
                            <span className="text-xs text-slate-400">
                                {formatUptime(peer.connectedAt)} uptime
                            </span>
                        )}
                    </div>

                    {isExpanded && peer.status === "connected" && (
                        <div className="mt-2 flex gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePing();
                                }}
                                disabled={isPinging}
                                className="text-xs px-2 py-1 border rounded hover:bg-white flex items-center gap-1"
                            >
                                <Zap className="w-3 h-3" />
                                {isPinging ? "Pinging..." : "Ping"}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDisconnect();
                                }}
                                className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50 flex items-center gap-1"
                            >
                                <X className="w-3 h-3" />
                                Disconnect
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
