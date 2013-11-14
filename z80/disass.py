#!/usr/bin/env python

import os, sys, re

def main(file):
  for line in open(file):
    line = re.sub('#.*', '', line.strip())
    if not line: continue
    parsed = line.split(' ', 2)
    if not ' ' in line:
      print 'case %s:' % line
      continue
    number, opcode = parsed[0:2]
    args = ""
    if len(parsed) >= 3: args = parsed[2]
    if opcode == 'shift':
      print 'case %s: return disassemble_%s(address);' % (number, args)
      continue
    print 'case %s: res="<span class=opcode>%s</span>";' % (number, opcode)
    args = re.sub(r'(REGISTER[HL]?)', r'<span class=register>" + \1 + "</span>', args);
    args = re.sub(r'(AF|BC|DE|HL|SP|PC|IX|IY|(\b[AFBCDEHL]\b))', r'<span class=register>\1</span>', args)
    if 'nnnn' in args:
      pre = args[0:args.find('nnnn')]
      post = args[args.find('nnnn') + 4:]
      print 'res += " %s" + addressHtml((readbyte(address + 1) << 8) | readbyte(address)) + "%s"; address += 2;' % (pre, post)
    elif 'nn' in args:
      pre = args[0:args.find('nn')]
      post = args[args.find('nn') + 2:]
      print 'res += " %s0x" + hexbyte(readbyte(address)) + "%s"; address += 1;' % (pre, post)
    elif 'offset' in args:
      pre = args[0:args.find('offset')]
      post = args[args.find('offset') + 6:]
      print 'var reladdr = address + 1 + sign_extend(readbyte(address));'
      print 'res += " %s" + addressHtml(reladdr) + "%s"; address += 1;' % (pre, post)
    elif 'dd' in args:
      pre = args[0:args.find('+dd')]
      post = args[args.find('+dd') + 3:]
      print 'var offset = sign_extend(readbyte(address));'
      print 'var sign = offset > 0 ? "+" : "-";'
      print 'res += " %s" + sign + "0x" + hexbyte(offset) + "%s"; address += 1;' % (pre, post)
    elif opcode == 'RST':
      print 'res += " " + addressHtml(0x' + args + ');'
    elif args:
      print 'res += " %s";' % args
    print "break;"

if __name__ == '__main__':
  main(sys.argv[1])

