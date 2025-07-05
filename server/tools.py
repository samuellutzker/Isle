import time
import json
import inspect
from uuid import UUID


class GameError(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(self.message)

def log(*x):
    print(time.strftime("[%d.%m.%Y %H:%M.%S]"), *x)

# remove functions from a dict or list of dicts
def strip_func(a):
    if type(a) == list:
        return [strip_func(b) for b in a]
    return { k:v for k,v in a.items() if not callable(v) }

# combine (+) contents of two dicts
def combine(a, b, f=lambda x, y: x + y):
    return { k: f(a.get(k, 0), b.get(k, 0)) for k in set(a) | set(b) }

def is_jsonable(o):
    try:
        json.dumps(o)
        return True
    except:
        return False

def jsonify(obj, ignore=[]):
    visit = set() # to prevent circular references
    def encode(o):
        if type(o) in ignore or o in ignore or id(o) in visit: 
            return None

        visit.add(id(o))

        if type(o) == list:
            out = [ encode(v) for v in o ]
        elif type(o) == dict:
            out = { k:ev for k,v in o.items() if not callable(v) and (ev := encode(v)) is not None }
        elif hasattr(o, '__dict__'):
            out = { k:ev for k,v in vars(o).items() if not callable(v) and (ev := encode(v)) is not None } | { '__class__': type(o).__name__ }
        else:
            out = o

        visit.remove(id(o))
        return out

    return json.dumps(encode(obj))

def unjsonify(json_str):
    def hook(obj):
        if type(obj) == dict and '__class__' in obj:
            cl = globals()[obj.pop('__class__')]
            args = { k:obj[k] for k in inspect.signature(cl.__init__).parameters if k in obj }
            out = cl(**args)
            out.__dict__ |= obj
        return out

    dec = json.JSONDecoder(object_hook=hook)
    return dec.decode(json_str)
