import time

class GameError(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(self.message)


def log(*x):
    print(time.strftime("[%d.%m.%Y %H:%M.%S]"), *x)

def strip_func(a):
    if type(a) == list:
        return [strip_func(b) for b in a]
    return { k:v for k,v in a.items() if not callable(v) }

def combine(a, b, f=lambda x, y: x + y): # combine (+) contents of two dicts
    return { k: f(a.get(k, 0), b.get(k, 0)) for k in set(a) | set(b) }
