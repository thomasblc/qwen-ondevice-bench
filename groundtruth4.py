#!/usr/bin/env python3
# Ground truth for probe3: graded-length iterative computations (the difficulty dial that made `fib` discriminate)
# + conceptual "correction" problems, to fill the 4B/9B middle band and add MoE-only problems.
a={}
def fibmod(N,m=1000):
    x,y=1,1
    for _ in range(N-1): x,y=y,(x+y)%(10**9)
    return y%m
a["fib60"]=fibmod(60)
a["fib80"]=fibmod(80)
a["fib90"]=fibmod(90)

# sum of first 50 primes
def primes(k):
    ps=[];n=2
    while len(ps)<k:
        if all(n%p for p in ps if p*p<=n): ps.append(n)
        n+=1
    return ps
a["sumprimes50"]=sum(primes(50))

# collatz steps for 27 to reach 1
n=27;steps=0
while n!=1:
    n=n//2 if n%2==0 else 3*n+1; steps+=1
a["collatz27"]=steps

# 8 people into 2 UNLABELED teams of 4
from math import comb
a["teams"]=comb(8,4)//2

# surjections: 7 distinct books to 3 students, each >=1
a["surj"]=3**7-3*2**7+3*1

# recurrence a1=3, a(n)=2a(n-1)+1, a(20)
v=3
for _ in range(19): v=2*v+1
a["recur20"]=v

# sum of digits of 20!
import math
a["digit20fact"]=sum(int(d) for d in str(math.factorial(20)))

for k,v in a.items(): print(f"{k} = {v}")
