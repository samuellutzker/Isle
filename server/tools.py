import time
import json
import inspect

class GameError(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(self.message)

def log(*x):
    print(time.strftime("[%d.%m.%Y %H:%M.%S]"), *x)

# combine (+) contents of two dicts
def combine(a, b, f=lambda x, y: x + y):
    return { k: f(a.get(k, 0), b.get(k, 0)) for k in set(a) | set(b) }

def jsonify(obj, ignore=[]):
    visit = list() # to prevent circular references
    def encode(o):
        def avoid(x):
            return callable(x) or type(x) in ignore or x in ignore or id(x) in visit

        visit.append(id(o))

        if type(o) == list:
            out = [ encode(v) for v in o ]
        elif type(o) == dict:
            out = { k:encode(v) for k,v in o.items() if not avoid(v) }
        elif hasattr(o, '__dict__'):
            out = { k:encode(v) for k,v in vars(o).items() if not avoid(v) }
        else:
            out = o

        visit.pop()
        return out

    return json.dumps(encode(obj))