import random
import time
from dataclasses import dataclass,field

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
            print("req-{request_id} dropped : No healthy servers available\n")
            return 

        server.connections+=1
        server.total_requests+=1
        print(f"req-{request_id} -> {server.id}(connections:{server.connections})")
        time.sleep(random.uniform(0.01,0.05))
        server.connections-=1

    def stats(self):
        print("\n stats \n")
        for s in self.servers:
            status="UP" if s.healthy else "DOWN"
            print(f"{s.id} [{status}] weight={s.weight} total={s.total_requests} active={s.connections}")


lb=LoadBalancer("round_robin")
lb.add_server(Server("A",weight=3))
lb.add_server(Server("B",weight=2))
lb.add_server(Server("C",weight=1))

for r in range(1,11):
    lb.handle_requests(r)

lb.stats()

