import { useEffect, useState } from "react"

const ALGOS = ["round_robin", "weighted", "least_connections", "random"]

export default function App() {
  const [servers, setServers] = useState([])
  const [ws, setWs] = useState(null)
  const [log, setLog] = useState([])
  const [algo, setAlgo] = useState("round_robin")
  const [totalReqs, setTotalReqs] = useState(0)
  const [dropped, setDropped] = useState(0)
  const [lastHit, setLastHit] = useState(null)

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/ws")
    socket.onopen = () => console.log("connected")
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.servers) setServers(msg.servers)
      if (msg.type === "request_routed") {
        setTotalReqs(r => r + 1)
        setLastHit(msg.routed_to)
        setLog(prev => [`REQ-${msg.req_id} → ${msg.routed_to}`, ...prev.slice(0, 49)])
        setTimeout(() => setLastHit(null), 400)
      } else if (msg.type === "dropped") {
        setDropped(d => d + 1)
        setLog(prev => [`REQ-${msg.req_id} DROPPED — no healthy servers`, ...prev.slice(0, 49)])
      }
    }
    socket.onclose = () => console.log("disconnected")
    setWs(socket)
    return () => socket.close()
  }, [])

  const sendRequest = () => ws?.send(JSON.stringify({ action: "send_request" }))

  const sendBurst = () => {
    let i = 0
    const interval = setInterval(() => {
      ws?.send(JSON.stringify({ action: "send_request" }))
      if (++i >= 10) clearInterval(interval)
    }, 100)
  }

  const toggleServer = (id) => ws?.send(JSON.stringify({ action: "toggle_server", server_id: id }))

  const changeAlgo = (a) => {
    setAlgo(a)
    ws?.send(JSON.stringify({ action: "change_algo", algo: a }))
  }

  const maxReqs = Math.max(...servers.map(s => s.total_requests), 1)

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 font-mono">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Load Balancer</h1>
        <p className="text-gray-500 text-sm mt-1">real-time traffic distribution</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "total requests", value: totalReqs },
          { label: "dropped", value: dropped },
          { label: "algorithm", value: algo.replace("_", " ") },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

    
      <div className="mb-8">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">algorithm</div>
        <div className="flex gap-2 flex-wrap">
          {ALGOS.map(a => (
            <button
              key={a}
              onClick={() => changeAlgo(a)}
              className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                algo === a
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              {a.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

     
      <div className="mb-8">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">servers</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {servers.map(s => (
            <div
              key={s.id}
              className={`rounded-xl p-4 border transition-all duration-200 ${
                !s.healthy
                  ? "bg-gray-900 border-gray-800 opacity-40"
                  : lastHit === s.id
                  ? "bg-emerald-900 border-emerald-500"
                  : "bg-gray-900 border-gray-700"
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-white">{s.id}</span>
                <button
                  onClick={() => toggleServer(s.id)}
                  className={`text-xs px-2 py-0.5 rounded border ${
                    s.healthy
                      ? "border-red-800 text-red-400 hover:bg-red-900"
                      : "border-emerald-800 text-emerald-400 hover:bg-emerald-900"
                  }`}
                >
                  {s.healthy ? "kill" : "revive"}
                </button>
              </div>
              <div className="text-xs text-gray-500 mb-3">weight {s.weight}</div>

              <div className="h-1 bg-gray-800 rounded-full overflow-hidden mb-2">
                <div
                  className="h-1 bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${(s.total_requests / maxReqs) * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-400">{s.total_requests} reqs</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mb-8">
        <button
          onClick={sendRequest}
          className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-lg text-sm transition-all active:scale-95"
        >
          Send Request
        </button>
        <button
          onClick={sendBurst}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-6 py-2 rounded-lg text-sm transition-all"
        >
          Burst × 10
        </button>
      </div>

      <div>
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">log</div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 max-h-48 overflow-y-auto">
          {log.length === 0 && <div className="text-gray-600 text-sm">no requests yet...</div>}
          {log.map((l, i) => (
            <div
              key={i}
              className={`text-sm ${l.includes("DROPPED") ? "text-red-400" : "text-gray-300"}`}
            >
              {l}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}