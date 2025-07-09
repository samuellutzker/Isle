import time
import json
import builtins

class GameError(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(self.message)

def log(*x):
    print(time.strftime("[%d.%m.%Y %H:%M.%S]"), *x)

# combine (+) contents of two dicts
def combine(a, b, f=lambda x, y: x + y):
    return { k: f(a.get(k, 0), b.get(k, 0)) for k in set(a) | set(b) }

def unjsonify(json_str):
    def maketype(t,k):
        return None if t == 'NoneType' else getattr(builtins, t)(k)

    def dec_item(k,v):
        if type(k) == str and k.startswith('__obj__'):
            return (maketype(v['type'], v['key']), v['value'])
        return k,v

    def hook(o):
        return o if type(o) != dict else dict([ dec_item(k,v) for k,v in o.items() ])

    return json.loads(json_str, object_hook=hook)

def jsonify(obj, ignore=[]):
    visit = list() # to prevent circular references
    def encode(o):
        def avoid(x):
            return callable(x) or type(x) in ignore or x in ignore or id(x) in visit

        def enc_item(k,v):
            return (k, encode(v)) if type(k) == str else ('__obj__'+str(id(k)), {
                'key' : k,
                'value' : v,
                'type' : type(k).__name__
            })

        visit.append(id(o))

        if type(o) == list:
            out = [ encode(v) for v in o if not avoid(v) ]
        elif type(o) == dict:
            out = dict([ enc_item(k,v) for k,v in o.items() if not avoid(v) ])
        elif hasattr(o, '__dict__'):
            out = dict([ enc_item(k,v) for k,v in vars(o).items() if not avoid(v) ])
        else:
            out = o

        visit.pop()
        return out

    return json.dumps(encode(obj))