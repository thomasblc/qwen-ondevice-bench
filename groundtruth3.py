#!/usr/bin/env python3
# Ground truth for HARDER pool (probe2), to find a real capability gradient under greedy decoding.
from math import comb
from itertools import product

a = {}

# 1 pairs: (a+b) | (a*b), 1<=a,b<=100
a["pairs"] = sum(1 for x in range(1,101) for y in range(1,101) if (x*y)%(x+y)==0)  # 170

# 2 euler: n in 1..100 with n^2+n+41 composite
def isp(n):
    if n<2: return False
    i=2
    while i*i<=n:
        if n%i==0: return False
        i+=1
    return True
a["euler"] = sum(1 for n in range(1,101) if not isp(n*n+n+41))  # 14

# 3 fib100mod1000
x,y=1,1
for _ in range(98): x,y=y,(x+y)%1000000
a["fib"] = y % 1000  # 75

# 4 walk: 10 moves +2/-1, never neg, end 8
a["walk"] = sum(1 for s in product([2,-1],repeat=10) if all(sum(s[:k+1])>=0 for k in range(10)) and sum(s)==8)  # 120

# 5 subsets of {1..10} no two consecutive = Fib(12)=144
cnt=0
for m in range(1<<10):
    bits=[i for i in range(10) if m&(1<<i)]
    if all(bits[j+1]-bits[j]>=2 for j in range(len(bits)-1)): cnt+=1
a["subsets"] = cnt  # 144

# 6 make change for 50 cents with 1,5,10,25
ways=0
for q in range(0,3):
    for d in range(0,6):
        for n in range(0,11):
            rem=50-25*q-10*d-5*n
            if rem>=0: ways+=1
a["change50"] = ways

# 7 compositions of 30 into parts {1,2,3} (tribonacci)
T=[0]*31; T[0]=1
for i in range(1,31):
    T[i]=(T[i-1] if i-1>=0 else 0)+(T[i-2] if i-2>=0 else 0)+(T[i-3] if i-3>=0 else 0)
a["trib30"] = T[30]

# 8 3^100 mod 100
a["mod3"] = pow(3,100,100)

# 9 perfect squares not cubes in 1..10000
sq=set(i*i for i in range(1,101) if i*i<=10000)
cu=set(i**3 for i in range(1,23) if i**3<=10000)
a["sqnotcube"] = len(sq-cu)

# 10 triples a<b<c positive integers, a+b+c=15
a["triples"] = sum(1 for x in range(1,16) for y in range(x+1,16) for z in range(y+1,16) if x+y+z==15)

for k,v in a.items(): print(f"{k} = {v}")
