import time
import json
import builtins

SPECIAL_KEY = '__obj__'

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
    is_list = False
    def maketype(t,k):
        return None if t == 'NoneType' else getattr(builtins, t)(k)

    def dec_item(k,v):
        nonlocal is_list
        is_list = False
        if type(k) == str and k.startswith(SPECIAL_KEY):
            if 'key' not in v: is_list = True
            return (maketype(v['ktype'], v['key']), maketype(v['vtype'], v['value'])) if 'key' in v else maketype(v['vtype'], v['value'])
        return k,v

    def hook(o):
        if type(o) != dict: return o
        o = [ dec_item(k,v) for k,v in o.items() ]
        return dict(o) if not is_list else o[0]

    return json.loads(json_str, object_hook=hook)

def jsonify(obj, ignore=[]):
    obj_count = 0
    visit = list() # delete circular references

    def encode(o):
        def avoid(x):
            return callable(x) or type(x) in ignore or x in ignore or id(x) in visit

        def enc_item(k,v, has_key=True):
            nonlocal obj_count
            obj_count += 1
            v = encode(v)
            if not has_key:
                return v if (
                    type(v) not in [set, tuple]
                    and (type(v) != str or not v.startswith(SPECIAL_KEY))
                ) else { SPECIAL_KEY + str(obj_count) : {
                    'value' : v,
                    'vtype' : type(v).__name__
                }}
            return (k, v) if (
                type(k) == str
                and not k.startswith(SPECIAL_KEY)
                and type(v) not in [set, tuple]
                and (type(v) != str or not v.startswith(SPECIAL_KEY))
            ) else (SPECIAL_KEY + str(obj_count), {
                'key' : k,
                'value' : v,
                'ktype' : type(k).__name__,
                'vtype' : type(v).__name__
            })

        visit.append(id(o))

        if type(o) == list:
            out = [ enc_item(None,v, False) for v in o if not avoid(v) ]
        elif type(o) == dict:
            out = dict([ enc_item(k,v) for k,v in o.items() if not avoid(v) ])
        elif hasattr(o, '__dict__'):
            out = dict([ enc_item(k,v) for k,v in vars(o).items() if not avoid(v) ])
        else:
            out = o

        visit.pop()
        return out

    return json.dumps(encode(obj))