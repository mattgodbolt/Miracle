#!/usr/bin/env python

import os, sys, re

def main(file):
  for line in open(file):
    line = re.sub('#.*', '', line.strip())
    if not line: continue
    parsed = line.split()
    if not ' ' in line:
      print 'case %s:' % line
      continue
    number, opcode = parsed[0:2]
    args = ""
    if len(parsed) >= 3: args = parsed[2]
    if opcode == 'shift':
      print 'case %s: return disassemble_%s(address);' % (number, args)
      continue
    print 'case %s: res="%s";' % (number, opcode)
    if 'nnnn' in args:
      pre = args[0:args.find('nnnn')]
      post = args[args.find('nnnn') + 4:]
      print 'res += " %s0x" + hexword((readbyte(address + 1) << 8) | readbyte(address)) + "%s"; address += 2;' % (pre, post)
    elif 'nn' in args:
      pre = args[0:args.find('nn')]
      post = args[args.find('nn') + 2:]
      print 'res += " %s0x" + hexbyte(readbyte(address)) + "%s"; address += 1;' % (pre, post)
    elif 'offset' in args:
      pre = args[0:args.find('offset')]
      post = args[args.find('offset') + 6:]
      print 'var reladdr = address + 1 + sign_extend(readbyte(address));'
      print 'res += " %s0x" + hexword(reladdr) + "%s"; address += 2;' % (pre, post)
    elif args:
      print 'res += " %s";' % args
    print "break;"

if __name__ == '__main__':
  main(sys.argv[1])

