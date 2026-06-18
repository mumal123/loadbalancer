from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
import json
import random
from dataclasses import dataclass
import asyncio

@dataclass
class Server:
    id:str
    weight:int=1
    connections:int=0
    total_requests:int=0
    healthy: bool=True

class LoadBalancer:
    def __init__ (self,algorithm="round_robin"):
        self.servers : list[Server]=[]
        self.algorithm=algorithm
        self.rr_index=0

    def add_server(self,server:Server):
        self.servers.append(server)

    def is_healthy(self):
        return [s for s in self.servers if s.healthy]

    def get_server(self)->Server | None :
        up=self.is_healthy()
        if not up:
            return None
        
        if self.algorithm=="round_robin":
            server=up[self.rr_index % len(up)]
            self.rr_index+=1
            return server
        
        elif self.algorithm=="weighted":
            pool=[s for s in up for _ in range(s.weight)]
            return random.choice(pool)

        elif self.algorithm=="least_connections":
            return min(up,key=lambda s:s.connections)

        elif self.algorithm=="random":
            return random.choice(up)
        
    def handle_requests(self,request_id:int):
        server=self.get_server()
        if not server:
            print(f"req-{request_id} dropped : No healthy servers available")
            return 

        server.connections+=1
        server.total_requests+=1
        print(f"req-{request_id} -> {server.id}(connections:{server.connections})")
       
        server.connections-=1

    def stats(self):
        print("\n stats \n")
        for s in self.servers:
            status="UP" if s.healthy else "DOWN"
            print(f"{s.id} [{status}] weight={s.weight} total={s.total_requests} active={s.connections}")


app = FastAPI()
lb = LoadBalancer("round_robin")
lb.add_server(Server("S1", weight=3))
lb.add_server(Server("S2", weight=2))
lb.add_server(Server("S3", weight=1))

request_counter = 0

def get_stats():
    return [
        {
            "id": s.id,
            "healthy": s.healthy,
            "weight": s.weight,
            "connections": s.connections,
            "total_requests": s.total_requests
        }
        for s in lb.servers
    ]

@app.get('/')
async def get():
    return {"status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global request_counter
    await websocket.accept()

    # send initial state on connect
    await websocket.send_text(json.dumps({
        "type": "stats",
        "servers": get_stats()
    }))

    async def process_request(server):
        await asyncio.sleep(random.uniform(0.5, 2))
        server.connections -= 1

    while True:
        data = await websocket.receive_text()
        msg = json.loads(data)
        action = msg.get("action")

        if action == "send_request":
            request_counter += 1
            server = lb.get_server()
            if server:
                server.connections += 1
                server.total_requests += 1
                await websocket.send_text(json.dumps({
                    "type": "request_routed",
                    "req_id": request_counter,
                    "routed_to": server.id,
                    "servers": get_stats()
                }))
                asyncio.create_task(process_request(server))
                
            else:
                await websocket.send_text(json.dumps({
                    "type": "dropped",
                    "req_id": request_counter,
                    "servers": get_stats()
                }))

        elif action == "toggle_server":
            sid = msg.get("server_id")
            for s in lb.servers:
                if s.id == sid:
                    s.healthy = not s.healthy
                    if not s.healthy:
                        s.connections = 0
            await websocket.send_text(json.dumps({
                "type": "stats",
                "servers": get_stats()
            }))

        elif action == "change_algo":
            lb.algorithm = msg.get("algo", "round_robin")
            lb.rr_index = 0
            await websocket.send_text(json.dumps({
                "type": "stats",
                "servers": get_stats()
            }))