/**
 * ============================================================================
 * OS STRUCTURE LAB: ABSTRACT CONCEPT-FOCUSED SYSTEMS SIMULATOR
 * Monolithic vs Layered vs Microkernel Operating System Architectures
 * Vanilla JavaScript (Zero Dependencies, Offline Compatible)
 * ============================================================================
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. COST MODEL CONSTANTS (SINGLE SOURCE OF TRUTH)
     ========================================================================== */
  const COST_MODEL = {
    APP_PREP: 15,          // Parameters set in registers (RAX, RDI, RSI, RDX)
    SYSCALL_TRAP: 150,     // MSR LSTAR hardware trap, CPL 3 -> 0, stack switch
    SYSRET: 150,           // sysretq / iretq, CPL 0 -> 3, user stack restore
    HOP_COST: 40,          // Layered function invocation overhead per boundary
    CTX_SWITCH: 900,       // Process context switch (CR3 reload, task state, registers)
    TLB_MISS_FLUSH: 200,   // Address space switch non-global TLB invalidation penalty
    IPC_COPY: 400,         // Microkernel IPC envelope marshalling & capability check
    DISK_IO: 500,          // Physical hardware DMA controller / bus transaction
    VFS_LOOKUP: 80,        // VFS inode table / descriptor resolution
    FS_INODE_OP: 110,      // File system extent resolution / directory block traversal
    DRIVER_DISPATCH: 70,   // Device driver MMIO submission queue entry
    MEM_PAGE_OP: 130,      // Memory allocator / COW page duplication / page table walk
    DAEMON_RESTART: 1500   // Reincarnation server crash detection, fork, exec, state restore
  };

  /* ==========================================================================
     2. SYSTEM CALL DEFINITIONS
     ========================================================================== */
  const Syscalls = {
    read: {
      name: 'read()',
      signature: 'ssize_t read(int fd, void *buf, size_t count);',
      tag: 'I/O In',
      desc: 'Fetch storage sectors into user buffer'
    },
    write: {
      name: 'write()',
      signature: 'ssize_t write(int fd, const void *buf, size_t count);',
      tag: 'I/O Out',
      desc: 'Flush dirty buffer pages to storage'
    },
    open: {
      name: 'open()',
      signature: 'int open(const char *pathname, int flags, mode_t mode);',
      tag: 'VFS',
      desc: 'Resolve path string and allocate fd'
    },
    fork: {
      name: 'fork()',
      signature: 'pid_t fork(void);',
      tag: 'Process',
      desc: 'Clone address space with COW pages'
    },
    send_message: {
      name: 'send_message()',
      signature: 'int send_message(int dest_pid, void *msg, size_t len);',
      tag: 'IPC',
      desc: 'Inter-process capability token transfer'
    }
  };

  /**
   * Abstract Node Coordinates for SVG Rendering (900 x 480 viewport)
   */
  const NodeLayouts = {
    monolithic: [
      { id: 'node_app', title: 'User Application', sub: 'Ring 3 • User Space', x: 180, y: 50, w: 220, h: 60, type: 'user' },
      { id: 'node_trap', title: 'Syscall Trap Gate', sub: 'MSR LSTAR • Ring Switch', x: 500, y: 50, w: 220, h: 60, type: 'kernel' },
      { id: 'node_kernel_box', title: 'Unified Monolithic Kernel (Ring 0)', sub: 'Single Shared Address Space', x: 140, y: 165, w: 620, h: 175, type: 'kernel-box' },
      { id: 'node_vfs', title: 'VFS & POSIX', sub: 'In-Kernel Call', x: 180, y: 225, w: 160, h: 55, type: 'kernel' },
      { id: 'node_fs', title: 'File System (Ext4)', sub: 'In-Kernel Call', x: 370, y: 225, w: 160, h: 55, type: 'kernel' },
      { id: 'node_driver', title: 'Storage Driver', sub: 'In-Kernel Call', x: 560, y: 225, w: 160, h: 55, type: 'kernel' },
      { id: 'node_hw', title: 'Physical Hardware', sub: 'NVMe / SSD Controller & MMU', x: 260, y: 395, w: 380, h: 55, type: 'hardware' }
    ],
    layered: [
      { id: 'l_l5', title: 'Layer 5: User Application', sub: 'Ring 3 • Top Tier', x: 220, y: 25, w: 460, h: 48, type: 'user', layerNum: 5 },
      { id: 'l_l4', title: 'Layer 4: Syscall / I/O Buffering', sub: 'Ring 0 • Device Abstraction', x: 220, y: 95, w: 460, h: 48, type: 'kernel', layerNum: 4 },
      { id: 'l_l3', title: 'Layer 3: File System Layer', sub: 'Ring 0 • Directory & Inodes', x: 220, y: 165, w: 460, h: 48, type: 'kernel', layerNum: 3 },
      { id: 'l_l2', title: 'Layer 2: Memory / Buffer Layer', sub: 'Ring 0 • Page Frame Manager', x: 220, y: 235, w: 460, h: 48, type: 'kernel', layerNum: 2 },
      { id: 'l_l1', title: 'Layer 1: Device Driver Layer', sub: 'Ring 0 • Hardware Control', x: 220, y: 305, w: 460, h: 48, type: 'kernel', layerNum: 1 },
      { id: 'l_l0', title: 'Layer 0: Physical Hardware', sub: 'Storage Disk, CPU & Bus', x: 220, y: 385, w: 460, h: 55, type: 'hardware', layerNum: 0 }
    ],
    microkernel: [
      { id: 'u_app', title: 'User Application', sub: 'Client • PID 101', x: 80, y: 55, w: 190, h: 65, type: 'user' },
      { id: 'u_fs', title: 'File Server', sub: 'Isolated Server • PID 10', x: 355, y: 55, w: 190, h: 65, type: 'user' },
      { id: 'u_driver', title: 'Disk Driver Server', sub: 'Isolated Server • PID 12', x: 630, y: 55, w: 190, h: 65, type: 'user' },
      { id: 'u_core', title: 'Microkernel Core (Ring 0)', sub: 'IPC Broker & Minimal Scheduler (<10k LOC)', x: 160, y: 220, w: 580, h: 80, type: 'kernel' },
      { id: 'u_reincarnation', title: 'Reincarnation Server', sub: 'Self-Healing Monitor • PID 2', x: 670, y: 345, w: 180, h: 55, type: 'user' },
      { id: 'u_hw', title: 'Physical Hardware', sub: 'Disk Controller & RAM', x: 240, y: 385, w: 420, h: 55, type: 'hardware' }
    ]
  };

  /**
   * Helper to compute cumulative metrics from per-stage deltas
   */
  function computeCumulativeMetrics(stages, stageIndex, faultRecovered = false) {
    let cycles = 0;
    let modeSwitches = 0;
    let ctxSwitches = 0;
    let ipc = 0;
    const visitedNodes = new Set();

    const limit = Math.min(stageIndex, stages.length - 1);
    for (let i = 0; i <= limit; i++) {
      const s = stages[i];
      cycles += s.deltaCycles;
      // A microkernel IPC hop (user -> kernel -> user server) crosses the privilege
      // boundary twice, so a stage that is both a mode switch and a context switch counts as 2.
      if (s.isModeSwitch) modeSwitches += s.isCtxSwitch ? 2 : 1;
      if (s.isCtxSwitch) ctxSwitches++;
      if (s.isIpcMessage) ipc++;
      if (s.activeNode) visitedNodes.add(s.activeNode);
    }

    if (faultRecovered) {
      cycles += COST_MODEL.DAEMON_RESTART;
    }

    return {
      cycles,
      modeSwitches,
      ctxSwitches,
      ipc,
      layers: visitedNodes.size
    };
  }

  /**
   * Stage definitions per architecture & syscall
   */
  function buildArchitectureStages(syscallKey) {
    const sc = Syscalls[syscallKey] || Syscalls.read;

    // ========================================================================
    // 1. MONOLITHIC ARCHITECTURE
    // ========================================================================
    let monoStages = [];

    if (syscallKey === 'read') {
      monoStages = [
        {
          num: 1,
          title: 'App Marshals read() Arguments',
          desc: 'User application loads parameters (RAX=0 for sys_read, RDI=3 for fd, RSI=buf, RDX=4096) into CPU registers.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'No privilege switch (stays in User Space)',
          isSwitch: false,
          activeNode: 'node_app',
          orb: { x: 290, y: 80 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: {
            'CPU Mode': 'User (Ring 3)',
            'Syscall': 'sys_read (0x00)',
            'Descriptor': 'fd=3 (data.log)',
            'Buffer Size': '4,096 Bytes'
          },
          microOp: 'mov rax, 0x00 ; sys_read',
          hardware: { cpl: 3, rax: '0x00', rip: '0x004010a0', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Hardware Privilege Trap (SYSCALL)',
          desc: 'CPU saves user RIP to RCX, switches CPL from Ring 3 to Ring 0, swaps stack pointer to kernel stack, and jumps to IA32_LSTAR.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Mode Switch (Ring 3 ➔ Ring 0)',
          isSwitch: true,
          activeNode: 'node_trap',
          orb: { x: 610, y: 80 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: {
            'CPU Mode': 'User ➔ Kernel (Ring 0)',
            'Stack Pointer': 'RSP: User ➔ Kernel Stack',
            'Privilege Level': 'CPL: 3 ➔ 0 (Supervisor)',
            'Trap Gate': 'MSR IA32_LSTAR'
          },
          microOp: 'syscall ; hardware trap gate',
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff81002340', rsp: '0xffffc9000010', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 3,
          title: 'VFS File Descriptor Lookup',
          desc: 'In-kernel VFS resolves descriptor fd=3 in the current process file table (fget_light) and checks read permissions.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (Direct in-memory C call)',
          isSwitch: false,
          activeNode: 'node_vfs',
          orb: { x: 260, y: 252 },
          deltaCycles: COST_MODEL.VFS_LOOKUP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: {
            'Active Subsystem': 'VFS & POSIX Layer',
            'File Struct': 'struct file* resolved',
            'Access Mode': 'O_RDONLY verified',
            'Call Mechanism': 'Direct in-kernel C call'
          },
          microOp: 'call vfs_read ; fget_light(3)',
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff81240180', rsp: '0xffffc9000030', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Ext4 File System Extent Translation',
          desc: 'Ext4 maps the file byte offset to physical disk Logical Block Addresses (LBA) and checks the kernel page cache.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (stays in supervisor space)',
          isSwitch: false,
          activeNode: 'node_fs',
          orb: { x: 450, y: 252 },
          deltaCycles: COST_MODEL.FS_INODE_OP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: {
            'Active Subsystem': 'Ext4 File System',
            'Inode': 'Inode #428190',
            'Extent Mapping': 'LBA Block 0x7e290',
            'Page Cache': 'Buffer Miss ➔ Disk Read'
          },
          microOp: 'call ext4_map_blocks',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff81310500', rsp: '0xffffc9000060', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 5,
          title: 'Storage Driver Command Queueing',
          desc: 'NVMe storage driver directly writes DMA read descriptors to the controller submission queue ring.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (Driver in supervisor space)',
          isSwitch: false,
          activeNode: 'node_driver',
          orb: { x: 640, y: 252 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: {
            'Active Subsystem': 'NVMe Storage Driver',
            'Submission Queue': 'SQ Tail Entry Appended',
            'DMA Buffer': 'Phys Addr 0x3d000',
            'Fault Isolation': 'Zero (Ring 0 Unrestricted)'
          },
          microOp: 'mov [rdi+SQ_TAIL], edx',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff81452200', rsp: '0xffffc9000080', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Hardware DMA Storage Read & IRQ',
          desc: 'Physical NVMe controller streams 4096 bytes into RAM via DMA and raises a completion interrupt.',
          mode: 'Hardware Execution',
          isKernel: true,
          switchText: 'Hardware Bus Transaction & DMA Transfer',
          isSwitch: false,
          activeNode: 'node_hw',
          orb: { x: 450, y: 422 },
          deltaCycles: COST_MODEL.DISK_IO,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: {
            'Active Subsystem': 'Physical Storage Hardware',
            'DMA Transfer': '4,096 Bytes to RAM',
            'Interrupt': 'MSI-X IRQ vector 42',
            'Data State': 'Sectors Cached in RAM'
          },
          microOp: 'in al, 0x64 ; DMA completion IRQ',
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff81015090', rsp: '0xffffc9000090', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Return to User Space (SYSRETQ)',
          desc: 'Kernel copies data to user buffer, loads RAX with 4096 bytes read, restores user RSP, and switches back to Ring 3.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: '⚡ Privilege Mode Switch (Ring 0 ➔ Ring 3)',
          isSwitch: true,
          activeNode: 'node_app',
          orb: { x: 290, y: 80 },
          deltaCycles: COST_MODEL.SYSRET,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: {
            'CPU Mode': 'Kernel ➔ User (Ring 3)',
            'Return Value': 'RAX = 4096 Bytes',
            'User Buffer': 'Populated with data',
            'Execution': 'User App resumes'
          },
          microOp: 'mov rax, 4096 ; sysretq',
          hardware: { cpl: 3, rax: '4096', rip: '0x004010a5', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        }
      ];
    } else if (syscallKey === 'write') {
      monoStages = [
        {
          num: 1,
          title: 'App Marshals write() Arguments',
          desc: 'User application loads parameters (RAX=1 for sys_write, RDI=3 for fd, RSI=buf, RDX=1024) into CPU registers.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'No privilege switch (stays in User Space)',
          isSwitch: false,
          activeNode: 'node_app',
          orb: { x: 290, y: 80 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User (Ring 3)', 'Syscall': 'sys_write (0x01)', 'Descriptor': 'fd=3', 'Payload': '1,024 Bytes' },
          microOp: 'mov rax, 0x01 ; sys_write',
          hardware: { cpl: 3, rax: '0x01', rip: '0x00401120', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Hardware Privilege Trap (SYSCALL)',
          desc: 'CPU elevates privilege to Ring 0, saves user RIP, and transitions to kernel syscall entry point.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Mode Switch (Ring 3 ➔ Ring 0)',
          isSwitch: true,
          activeNode: 'node_trap',
          orb: { x: 610, y: 80 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User ➔ Kernel (Ring 0)', 'Stack Pointer': 'RSP: User ➔ Kernel Stack', 'Privilege': 'CPL: 3 ➔ 0' },
          microOp: 'syscall ; hardware trap',
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff81002340', rsp: '0xffffc9000010', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 3,
          title: 'VFS Write Validation & Append Check',
          desc: 'VFS validates write permissions on file descriptor fd=3 and checks file size limits and O_APPEND status.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (In-kernel direct function call)',
          isSwitch: false,
          activeNode: 'node_vfs',
          orb: { x: 260, y: 252 },
          deltaCycles: COST_MODEL.VFS_LOOKUP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Subsystem': 'VFS & POSIX', 'Validation': 'Write permission verified', 'Offset': 'i_size updated (+1024)' },
          microOp: 'call vfs_write ; check permissions',
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff81240320', rsp: '0xffffc9000030', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Ext4 Journaling & Buffer Dirtying',
          desc: 'Ext4 allocates storage blocks, copies user buffer into page cache, marks pages dirty, and starts jbd2 journal transaction.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (stays in supervisor space)',
          isSwitch: false,
          activeNode: 'node_fs',
          orb: { x: 450, y: 252 },
          deltaCycles: COST_MODEL.FS_INODE_OP + 30,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Subsystem': 'Ext4 File System', 'Journal': 'jbd2 transaction active', 'Page Cache': 'Marked Dirty' },
          microOp: 'call ext4_da_write_begin',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff81315100', rsp: '0xffffc9000060', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 5,
          title: 'Storage Driver Flush Queue Dispatch',
          desc: 'Device driver constructs block I/O request (BIO) and schedules hardware writeback command to disk controller.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (Driver in supervisor space)',
          isSwitch: false,
          activeNode: 'node_driver',
          orb: { x: 640, y: 252 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Subsystem': 'Storage Driver', 'BIO Request': 'Flush queue programmed', 'MMIO': 'Direct register write' },
          microOp: 'call blk_mq_submit_bio',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff81452440', rsp: '0xffffc9000080', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Physical Storage Writeback & Bus IRQ',
          desc: 'Storage hardware controller commits dirty cache blocks to non-volatile flash storage and signals write completion.',
          mode: 'Hardware Execution',
          isKernel: true,
          switchText: 'Hardware Bus Transaction & Flash Programming',
          isSwitch: false,
          activeNode: 'node_hw',
          orb: { x: 450, y: 422 },
          deltaCycles: COST_MODEL.DISK_IO,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Subsystem': 'Physical Storage', 'Flash Media': 'Blocks programmed', 'IRQ': 'Write Complete signaled' },
          microOp: 'out 0x1f7, al ; DMA write commit',
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff81015090', rsp: '0xffffc9000090', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Return to User Space (SYSRETQ)',
          desc: 'Kernel restores user registers, sets RAX=1024 (bytes written), and executes SYSRETQ to resume unprivileged application.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: '⚡ Privilege Mode Switch (Ring 0 ➔ Ring 3)',
          isSwitch: true,
          activeNode: 'node_app',
          orb: { x: 290, y: 80 },
          deltaCycles: COST_MODEL.SYSRET,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'Kernel ➔ User (Ring 3)', 'Return Value': 'RAX = 1024 Bytes written', 'Status': 'Success (0 errors)' },
          microOp: 'mov rax, 1024 ; sysretq',
          hardware: { cpl: 3, rax: '1024', rip: '0x00401125', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        }
      ];
    } else if (syscallKey === 'open') {
      monoStages = [
        {
          num: 1,
          title: 'App Marshals open() Pathname & Flags',
          desc: 'Application prepares path string pointer ("/var/log/sys.log") and mode flags (O_RDONLY) into registers RAX=2, RDI, RSI.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'No privilege switch (stays in User Space)',
          isSwitch: false,
          activeNode: 'node_app',
          orb: { x: 290, y: 80 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User (Ring 3)', 'Syscall': 'sys_open (0x02)', 'Target Path': '"/var/log/sys.log"', 'Flags': 'O_RDONLY' },
          microOp: 'mov rax, 0x02 ; sys_open',
          hardware: { cpl: 3, rax: '0x02', rip: '0x00401200', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Hardware Privilege Trap (SYSCALL)',
          desc: 'CPU switches CPL 3 to 0, saves user instruction pointer, and transfers execution to supervisor gate.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Mode Switch (Ring 3 ➔ Ring 0)',
          isSwitch: true,
          activeNode: 'node_trap',
          orb: { x: 610, y: 80 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User ➔ Kernel (Ring 0)', 'Privilege': 'Ring 0 Supervisor', 'Stack': 'Kernel RSP Loaded' },
          microOp: 'syscall ; hardware trap gate',
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff81002340', rsp: '0xffffc9000010', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 3,
          title: 'VFS Dentry Path Walk & Security Check',
          desc: 'VFS resolves path tokens through directory dentry cache and validates user access permissions.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (stays in supervisor space)',
          isSwitch: false,
          activeNode: 'node_vfs',
          orb: { x: 260, y: 252 },
          deltaCycles: COST_MODEL.VFS_LOOKUP + 10,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Path Walk': 'var ➔ log ➔ sys.log', 'Dentry Cache': 'Hit on /var/log', 'Permissions': 'Read Allowed' },
          microOp: 'call do_sys_openat2 ; dentry walk',
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff81245010', rsp: '0xffffc9000030', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Ext4 Inode Resolution & Directory Scan',
          desc: 'Ext4 reads directory entry metadata and resolves filename to disk inode number #421098.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (internal function call)',
          isSwitch: false,
          activeNode: 'node_fs',
          orb: { x: 450, y: 252 },
          deltaCycles: COST_MODEL.FS_INODE_OP + 10,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Subsystem': 'Ext4 File System', 'Resolved Inode': '#421098', 'File Size': '65,536 Bytes' },
          microOp: 'call ext4_lookup ; inode resolution',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff81316200', rsp: '0xffffc9000060', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 5,
          title: 'Storage Driver Inode Metadata Fetch',
          desc: 'Device driver queues DMA read command to retrieve file attribute and permission block from storage.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (in-kernel driver execution)',
          isSwitch: false,
          activeNode: 'node_driver',
          orb: { x: 640, y: 252 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Subsystem': 'Storage Driver', 'Command': 'Read Inode Sector', 'DMA Address': '0x4f000' },
          microOp: 'call nvme_submit_cmd ; metadata fetch',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff81453100', rsp: '0xffffc9000080', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Hardware Controller Inode Transfer',
          desc: 'Storage hardware loads inode block into kernel buffer memory and completes transaction.',
          mode: 'Hardware Execution',
          isKernel: true,
          switchText: 'Hardware Bus Transaction',
          isSwitch: false,
          activeNode: 'node_hw',
          orb: { x: 450, y: 422 },
          deltaCycles: COST_MODEL.DISK_IO,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Physical Device': 'NVMe Media', 'Metadata Transfer': 'Inode #421098 Loaded', 'IRQ': 'Dispatched' },
          microOp: 'in al, 0x20 ; IRQ complete',
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff81015090', rsp: '0xffffc9000090', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'File Table Allocation & SYSRETQ',
          desc: 'Kernel allocates new struct file, binds descriptor fd=3 in process PCB table, and returns fd in RAX.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: '⚡ Privilege Mode Switch (Ring 0 ➔ Ring 3)',
          isSwitch: true,
          activeNode: 'node_app',
          orb: { x: 290, y: 80 },
          deltaCycles: COST_MODEL.SYSRET,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'Kernel ➔ User (Ring 3)', 'Allocated FD': 'fd = 3', 'Return Value': 'RAX = 3' },
          microOp: 'mov rax, 3 ; sysretq',
          hardware: { cpl: 3, rax: '3', rip: '0x00401205', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        }
      ];
    } else if (syscallKey === 'fork') {
      monoStages = [
        {
          num: 1,
          title: 'App Marshals fork() Invocation',
          desc: 'User application loads RAX=57 (sys_fork) and executes syscall to clone current process address space.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'No privilege switch (stays in User Space)',
          isSwitch: false,
          activeNode: 'node_app',
          orb: { x: 290, y: 80 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User (Ring 3)', 'Syscall': 'sys_fork (0x39 / 57)', 'Parent PID': 'PID 101', 'Address Space': 'CR3: 0x1a00' },
          microOp: 'mov rax, 57 ; sys_fork',
          hardware: { cpl: 3, rax: '0x39', rip: '0x00401300', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Hardware Privilege Trap (SYSCALL)',
          desc: 'CPU elevates privilege to Ring 0, switches to kernel stack, and transfers execution to supervisor gate.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Mode Switch (Ring 3 ➔ Ring 0)',
          isSwitch: true,
          activeNode: 'node_trap',
          orb: { x: 610, y: 80 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User ➔ Kernel (Ring 0)', 'Privilege': 'Ring 0 Supervisor', 'Stack': 'Kernel Stack Active' },
          microOp: 'syscall ; hardware trap gate',
          hardware: { cpl: 0, rax: '0x39', rip: '0xffffffff81002340', rsp: '0xffffc9000010', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 3,
          title: 'PCB Duplication & PID Allocation',
          desc: 'Kernel allocates new task_struct for child, copies parent CPU context, and allocates new PID 102.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (stays in supervisor space)',
          isSwitch: false,
          activeNode: 'node_vfs',
          orb: { x: 260, y: 252 },
          deltaCycles: COST_MODEL.VFS_LOOKUP + 100,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Task Structure': 'copy_process()', 'New Child PID': 'PID 102', 'Credentials': 'UID/GID Cloned' },
          microOp: 'call copy_process ; alloc PCB',
          hardware: { cpl: 0, rax: '0x39', rip: '0xffffffff81120040', rsp: '0xffffc9000040', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'File Descriptor Table Reference Cloning',
          desc: 'Kernel increments reference counts on all open file structures inherited by the child in the VFS/Ext4 file table.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (stays in supervisor space)',
          isSwitch: false,
          activeNode: 'node_fs',
          orb: { x: 450, y: 252 },
          deltaCycles: COST_MODEL.FS_INODE_OP - 20,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'File Descriptors': 'dup_fd() complete', 'Inherited Files': 'stdin, stdout, data.log', 'File Refs': 'atomic_inc(&f_count)' },
          microOp: 'call dup_fd ; clone open files',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 0, rax: '0x39', rip: '0xffffffff81247100', rsp: '0xffffc9000070', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 5,
          title: 'Virtual Memory & COW Page Table Cloning',
          desc: 'Clones page table hierarchy (PML4 ➔ PT), marks all writable memory pages as Copy-On-Write (COW), and clears write bit.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (kernel memory management)',
          isSwitch: false,
          activeNode: 'node_driver',
          orb: { x: 640, y: 252 },
          deltaCycles: COST_MODEL.MEM_PAGE_OP * 2 + 100,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Memory Pages': 'Marked Read-Only / COW', 'Child CR3': 'Allocated: 0x1e00', 'TLB Action': 'Write protect enforced' },
          microOp: 'call copy_page_range ; COW tag',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 0, rax: '0x39', rip: '0xffffffff81182500', rsp: '0xffffc9000090', cr3: '0x1a00', tlb: 'MISS', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Scheduler Runqueue Placement & MMU Sync',
          desc: 'Kernel adds child PID 102 to CPU runqueue, sets child RAX=0, and prepares CPU scheduling quantum.',
          mode: 'Hardware Execution',
          isKernel: true,
          switchText: 'Hardware MMU / APIC Timer Sync',
          isSwitch: false,
          activeNode: 'node_hw',
          orb: { x: 450, y: 422 },
          deltaCycles: COST_MODEL.MEM_PAGE_OP + 90,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Child Status': 'READY on Runqueue', 'Child Return': 'RAX = 0 (Child context)', 'Parent Return': 'RAX = 102 (Child PID)' },
          microOp: 'call wake_up_new_task(PID_102)',
          hardware: { cpl: 0, rax: '102', rip: '0xffffffff81084200', rsp: '0xffffc90000b0', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Return to Parent Application (SYSRETQ)',
          desc: 'Kernel restores user registers and switches to Ring 3. Parent resumes execution receiving child PID 102 in RAX.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: '⚡ Privilege Mode Switch (Ring 0 ➔ Ring 3)',
          isSwitch: true,
          activeNode: 'node_app',
          orb: { x: 290, y: 80 },
          deltaCycles: COST_MODEL.SYSRET,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'Kernel ➔ User (Ring 3)', 'Parent RAX': '102 (Child PID)', 'Child State': 'Ready to execute' },
          microOp: 'mov rax, 102 ; sysretq (Parent)',
          hardware: { cpl: 3, rax: '102', rip: '0x00401305', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        }
      ];
    } else {
      // send_message
      monoStages = [
        {
          num: 1,
          title: 'App Marshals send_message() Payload',
          desc: 'Application prepares IPC envelope (RAX=180, RDI=dest_pid 104, RSI=msg_buf, RDX=64 bytes) in user registers.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'No privilege switch (stays in User Space)',
          isSwitch: false,
          activeNode: 'node_app',
          orb: { x: 290, y: 80 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User (Ring 3)', 'Syscall': 'sys_send_msg (180)', 'Target PID': 'PID 104', 'Payload': '64 Bytes Token' },
          microOp: 'mov rax, 180 ; sys_send_msg',
          hardware: { cpl: 3, rax: '180', rip: '0x00401400', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Hardware Privilege Trap (SYSCALL)',
          desc: 'CPU elevates privilege to Ring 0, saves user RIP, and transfers execution to supervisor gate.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Mode Switch (Ring 3 ➔ Ring 0)',
          isSwitch: true,
          activeNode: 'node_trap',
          orb: { x: 610, y: 80 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User ➔ Kernel (Ring 0)', 'Privilege': 'Ring 0 Supervisor', 'Stack': 'Kernel Stack Active' },
          microOp: 'syscall ; hardware trap gate',
          hardware: { cpl: 0, rax: '180', rip: '0xffffffff81002340', rsp: '0xffffc9000010', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 3,
          title: 'Kernel IPC Mailbox & Capability Check',
          desc: 'Kernel validates IPC capability token, checks destination PID 104 permissions, and locates receiver mailbox.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (stays in supervisor space)',
          isSwitch: false,
          activeNode: 'node_vfs',
          orb: { x: 260, y: 252 },
          deltaCycles: COST_MODEL.VFS_LOOKUP - 10,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Capability': 'Validated in Kernel', 'Mailbox': 'Queue for PID 104 found', 'Protection': 'Direct memory check' },
          microOp: 'call ipc_obtain_object ; check cap',
          hardware: { cpl: 0, rax: '180', rip: '0xffffffff81290100', rsp: '0xffffc9000030', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Shared Ring Buffer Enqueue',
          desc: 'Kernel copies 64-byte payload from user space directly into receiver socket ring buffer in kernel memory.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (internal function call)',
          isSwitch: false,
          activeNode: 'node_fs',
          orb: { x: 450, y: 252 },
          deltaCycles: COST_MODEL.FS_INODE_OP - 30,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Queue Action': 'Payload Appended', 'Ring Buffer': 'Kernel shared buffer', 'Bytes Copied': '64 Bytes' },
          microOp: 'call af_unix_stream_send',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 0, rax: '180', rip: '0xffffffff81330150', rsp: '0xffffc9000060', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 5,
          title: 'Inter-Process Interrupt (IPI) / Driver Signal',
          desc: 'Kernel triggers inter-processor interrupt to alert destination CPU core that message is pending.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: 'No switch (stays in supervisor space)',
          isSwitch: false,
          activeNode: 'node_driver',
          orb: { x: 640, y: 252 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH - 10,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'IPI Signal': 'APIC Vector Sent', 'Target Core': 'CPU #1 Notified', 'Receiver State': 'WAITING ➔ READY' },
          microOp: 'call smp_send_reschedule(CPU_1)',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 0, rax: '180', rip: '0xffffffff81041200', rsp: '0xffffc9000080', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Receiver Wakeup & APIC MMIO Dispatch',
          desc: 'Physical local APIC hardware registers transaction and dispatches scheduler tick to wake receiver.',
          mode: 'Hardware Execution',
          isKernel: true,
          switchText: 'Hardware MMIO APIC Bus Event',
          isSwitch: false,
          activeNode: 'node_hw',
          orb: { x: 450, y: 422 },
          deltaCycles: COST_MODEL.MEM_PAGE_OP - 10,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Hardware Event': 'APIC ICR write', 'Receiver Task': 'Unblocked', 'Message Status': 'Delivered' },
          microOp: 'mov [APIC_ICR], eax ; send IPI',
          hardware: { cpl: 0, rax: '0', rip: '0xffffffff81015090', rsp: '0xffffc9000090', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Return to Sender Application (SYSRETQ)',
          desc: 'Kernel restores user registers, sets RAX=0 (success), and returns CPU privilege to Ring 3.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: '⚡ Privilege Mode Switch (Ring 0 ➔ Ring 3)',
          isSwitch: true,
          activeNode: 'node_app',
          orb: { x: 290, y: 80 },
          deltaCycles: COST_MODEL.SYSRET,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'Kernel ➔ User (Ring 3)', 'Return Value': 'RAX = 0 (Success)', 'Sender': 'Continues execution' },
          microOp: 'mov rax, 0 ; sysretq (Status OK)',
          hardware: { cpl: 3, rax: '0', rip: '0x00401405', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        }
      ];
    }

    // ========================================================================
    // 2. LAYERED ARCHITECTURE (SYSCALL SPECIFIC)
    // ========================================================================
    const hopCycles = COST_MODEL.HOP_COST;
    let layerStages = [];

    if (syscallKey === 'read') {
      layerStages = [
        {
          num: 1,
          title: 'Layer 5: User Application Invocation (read)',
          desc: 'Layer 5 user process marshals read parameters (fd=3, buf, 4096) and invokes downward call gate to Layer 4.',
          mode: 'User Mode (Layer 5)',
          isKernel: false,
          switchText: 'No switch (Layer 5 User Tier)',
          isSwitch: false,
          activeNode: 'l_l5',
          orb: { x: 450, y: 49 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 5 (User App)', 'Target Tier': 'Layer 4 (I/O Buffering)', 'Boundary': 'L5 ➔ L4 Gate', 'Operation': 'read() initiated' },
          microOp: 'call L5_to_L4_gate ; read(3, buf, 4096)',
          hardware: { cpl: 3, rax: '0x00', rip: '0x004010a0', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 5 Client', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Layer 4: Syscall Validation & I/O Buffering',
          desc: 'Layer 4 validates file descriptor fd=3, manages stream buffers, and calls downward into Layer 3.',
          mode: 'Kernel Mode (Layer 4)',
          isKernel: true,
          switchText: '⚡ Privilege Mode Switch (L5 User ➔ L4 Kernel)',
          isSwitch: true,
          activeNode: 'l_l4',
          orb: { x: 450, y: 119 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + hopCycles,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 4 (I/O Buffering)', 'Boundary Hop': 'L5 ➔ L4 (+40c overhead)', 'Privilege': 'Ring 0 Supervisor', 'Encapsulation': 'L4 cannot see L2 or L1' },
          microOp: 'call L4_buffer_validate ; fd=3 check',
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff81200100', rsp: '0xffffc9000020', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 4 Kernel', state: 'RUNNING' } }
        },
        {
          num: 3,
          title: 'Layer 3: File System & Inode Block Mapping',
          desc: 'Layer 3 resolves file extent blocks and checks inode permissions. Invokes Layer 2.',
          mode: 'Kernel Mode (Layer 3)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L4 ➔ L3)',
          isSwitch: false,
          activeNode: 'l_l3',
          orb: { x: 450, y: 189 },
          deltaCycles: COST_MODEL.FS_INODE_OP + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 3 (File System)', 'Boundary Hop': 'L4 ➔ L3 (+40c overhead)', 'Structure': 'Directory & Inodes', 'Invariant': 'Calls ONLY Layer 2' },
          microOp: 'call L3_resolve_extent ; inode #428190',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff81300200', rsp: '0xffffc9000040', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 3 FS', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Layer 2: Memory & Page Frame Translation',
          desc: 'Layer 2 translates user buffer addresses to physical page frames and checks paging permissions before calling Layer 1.',
          mode: 'Kernel Mode (Layer 2)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L3 ➔ L2)',
          isSwitch: false,
          activeNode: 'l_l2',
          orb: { x: 450, y: 259 },
          deltaCycles: COST_MODEL.MEM_PAGE_OP + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 2 (Memory Management)', 'Boundary Hop': 'L3 ➔ L2 (+40c overhead)', 'Translation': 'Virtual Address ➔ PFN Frame', 'Invariant': 'Calls ONLY Layer 1' },
          microOp: 'call L2_map_page_frame ; buffer PFN',
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff81400300', rsp: '0xffffc9000060', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 2 MMU', state: 'RUNNING' } }
        },
        {
          num: 5,
          title: 'Layer 1: Device Driver & Hardware Dispatch',
          desc: 'Layer 1 formats hardware command packets and queues DMA read command to physical device registers.',
          mode: 'Kernel Mode (Layer 1)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L2 ➔ L1)',
          isSwitch: false,
          activeNode: 'l_l1',
          orb: { x: 450, y: 329 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 1 (Device Driver)', 'Boundary Hop': 'L2 ➔ L1 (+40c overhead)', 'Command': 'NVMe DMA Read Descriptor', 'Target': 'Layer 0 Hardware' },
          microOp: 'call L1_device_dispatch ; queue DMA',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff81500400', rsp: '0xffffc9000080', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 1 Driver', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Layer 0: Hardware Physical Execution',
          desc: 'Physical storage controller executes DMA sector read and signals hardware interrupt lines.',
          mode: 'Hardware Execution (Layer 0)',
          isKernel: true,
          switchText: 'Lowest Tier Execution (Layer 0)',
          isSwitch: false,
          activeNode: 'l_l0',
          orb: { x: 450, y: 412 },
          deltaCycles: COST_MODEL.DISK_IO,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 0 (Hardware & MMU)', 'Hardware State': 'DMA Read Complete', 'Interrupt': 'IRQ raised to Layer 1', 'Direction': 'Bubbling results back up' },
          microOp: 'in al, 0x20 ; IRQ complete',
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff81015090', rsp: '0xffffc9000090', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 0 Hardware', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Cascade Return (L0 ➔ L1 ➔ L2 ➔ L3 ➔ L4 ➔ L5)',
          desc: 'Results bubble upward through all 5 layers in reverse order, verifying layer invariants at each step before reaching User App.',
          mode: 'User Mode (Layer 5)',
          isKernel: false,
          switchText: '⚡ Privilege Mode Switch (L4 Kernel ➔ L5 User)',
          isSwitch: true,
          activeNode: 'l_l5',
          orb: { x: 450, y: 49 },
          deltaCycles: COST_MODEL.SYSRET + (hopCycles * 5),
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Return Cascade': 'L0 ➔ L1 ➔ L2 ➔ L3 ➔ L4 ➔ L5', 'Layer Traversal': '10 cross-layer hops total', 'Overhead Added': '+400 cycles in stack traversal', 'Reliability': 'Clean formal verification' },
          microOp: 'ret ; L5 application resumed with 4096 bytes',
          hardware: { cpl: 3, rax: '4096', rip: '0x004010a5', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 5 Client', state: 'RUNNING' } }
        }
      ];
    } else if (syscallKey === 'write') {
      layerStages = [
        {
          num: 1,
          title: 'Layer 5: User Application Invocation (write)',
          desc: 'Layer 5 application marshals write arguments (fd=3, buf, 1024) and invokes call gate downward to Layer 4.',
          mode: 'User Mode (Layer 5)',
          isKernel: false,
          switchText: 'No switch (Layer 5 User Tier)',
          isSwitch: false,
          activeNode: 'l_l5',
          orb: { x: 450, y: 49 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 5 (User App)', 'Target Tier': 'Layer 4 (I/O Buffering)', 'Boundary': 'L5 ➔ L4 Gate', 'Operation': 'write() initiated' },
          microOp: 'call L5_to_L4_gate ; write(3, buf, 1024)',
          hardware: { cpl: 3, rax: '0x01', rip: '0x00401120', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 5 Client', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Layer 4: Stream Buffer & Write Validation',
          desc: 'Layer 4 verifies write permissions on descriptor fd=3 and manages kernel stream buffer.',
          mode: 'Kernel Mode (Layer 4)',
          isKernel: true,
          switchText: '⚡ Privilege Mode Switch (L5 User ➔ L4 Kernel)',
          isSwitch: true,
          activeNode: 'l_l4',
          orb: { x: 450, y: 119 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + hopCycles,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 4 (I/O Buffering)', 'Boundary Hop': 'L5 ➔ L4 (+40c overhead)', 'Validation': 'Write permission verified' },
          microOp: 'call L4_write_validate',
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff81200180', rsp: '0xffffc9000020', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 4 Kernel', state: 'RUNNING' } }
        },
        {
          num: 3,
          title: 'Layer 3: File System Journal & Block Allocation',
          desc: 'Layer 3 allocates storage blocks and records journal transaction for file integrity.',
          mode: 'Kernel Mode (Layer 3)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L4 ➔ L3)',
          isSwitch: false,
          activeNode: 'l_l3',
          orb: { x: 450, y: 189 },
          deltaCycles: COST_MODEL.FS_INODE_OP + 40 + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 3 (File System)', 'Journal': 'Transaction Active', 'Blocks': 'Allocated LBA' },
          microOp: 'call L3_journal_commit',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff81300340', rsp: '0xffffc9000040', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 3 FS', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Layer 2: Memory Cache & Dirty Page Tagging',
          desc: 'Layer 2 marks buffer cache pages dirty and translates addresses for hardware DMA access.',
          mode: 'Kernel Mode (Layer 2)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L3 ➔ L2)',
          isSwitch: false,
          activeNode: 'l_l2',
          orb: { x: 450, y: 259 },
          deltaCycles: COST_MODEL.MEM_PAGE_OP + 20 + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 2 (Memory Management)', 'Page State': 'Dirty Buffer Marked', 'Translation': 'Physical Pinning' },
          microOp: 'call L2_mark_dirty_pages',
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff81400380', rsp: '0xffffc9000060', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 2 MMU', state: 'RUNNING' } }
        },
        {
          num: 5,
          title: 'Layer 1: Device Driver Writeback Dispatch',
          desc: 'Layer 1 constructs hardware writeback packet and commits command to device controller.',
          mode: 'Kernel Mode (Layer 1)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L2 ➔ L1)',
          isSwitch: false,
          activeNode: 'l_l1',
          orb: { x: 450, y: 329 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH + 10 + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 1 (Device Driver)', 'Queue Action': 'Flush Command Submitted', 'Target': 'Physical Disk' },
          microOp: 'call L1_queue_writeback',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff81500440', rsp: '0xffffc9000080', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 1 Driver', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Layer 0: Hardware Physical Flash Write',
          desc: 'Physical storage controller flashes dirty blocks to non-volatile memory and raises completion interrupt.',
          mode: 'Hardware Execution (Layer 0)',
          isKernel: true,
          switchText: 'Lowest Tier Execution (Layer 0)',
          isSwitch: false,
          activeNode: 'l_l0',
          orb: { x: 450, y: 412 },
          deltaCycles: COST_MODEL.DISK_IO,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 0 (Hardware & MMU)', 'Flash Cells': '1024 Bytes Committed', 'IRQ': 'Write complete' },
          microOp: 'out 0x1f7, al ; DMA write commit',
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff81015090', rsp: '0xffffc9000090', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 0 Hardware', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Cascade Return (L0 ➔ L1 ➔ L2 ➔ L3 ➔ L4 ➔ L5)',
          desc: 'Results bubble upward through all 5 layers in reverse order, verifying layer invariants at each step before reaching User App.',
          mode: 'User Mode (Layer 5)',
          isKernel: false,
          switchText: '⚡ Privilege Mode Switch (L4 Kernel ➔ L5 User)',
          isSwitch: true,
          activeNode: 'l_l5',
          orb: { x: 450, y: 49 },
          deltaCycles: COST_MODEL.SYSRET + (hopCycles * 5),
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Return Cascade': 'L0 ➔ L1 ➔ L2 ➔ L3 ➔ L4 ➔ L5', 'Return Value': 'RAX = 1024 Bytes', 'Status': 'Success' },
          microOp: 'ret ; write completed (1024 bytes)',
          hardware: { cpl: 3, rax: '1024', rip: '0x00401125', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 5 Client', state: 'RUNNING' } }
        }
      ];
    } else if (syscallKey === 'open') {
      layerStages = [
        {
          num: 1,
          title: 'Layer 5: User Application Invocation (open)',
          desc: 'Layer 5 application prepares path string pointer and mode flags, invoking call gate to Layer 4.',
          mode: 'User Mode (Layer 5)',
          isKernel: false,
          switchText: 'No switch (Layer 5 User Tier)',
          isSwitch: false,
          activeNode: 'l_l5',
          orb: { x: 450, y: 49 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 5 (User App)', 'Path': '"/var/log/sys.log"', 'Flags': 'O_RDONLY' },
          microOp: 'call L5_to_L4_gate ; open("/var/log/sys.log")',
          hardware: { cpl: 3, rax: '0x02', rip: '0x00401200', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 5 Client', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Layer 4: Syscall File Descriptor Allocation',
          desc: 'Layer 4 allocates descriptor slot in process file table and checks system-wide open file limits.',
          mode: 'Kernel Mode (Layer 4)',
          isKernel: true,
          switchText: '⚡ Privilege Mode Switch (L5 User ➔ L4 Kernel)',
          isSwitch: true,
          activeNode: 'l_l4',
          orb: { x: 450, y: 119 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + hopCycles,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 4 (Descriptor Alloc)', 'FD Slot': 'Allocated fd=3', 'Privilege': 'Ring 0' },
          microOp: 'call L4_alloc_fd_slot',
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff81200210', rsp: '0xffffc9000020', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 4 Kernel', state: 'RUNNING' } }
        },
        {
          num: 3,
          title: 'Layer 3: File System Path Dentry Walk',
          desc: 'Layer 3 resolves path components and scans directory table to locate inode #421098.',
          mode: 'Kernel Mode (Layer 3)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L4 ➔ L3)',
          isSwitch: false,
          activeNode: 'l_l3',
          orb: { x: 450, y: 189 },
          deltaCycles: COST_MODEL.FS_INODE_OP + 10 + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 3 (File System)', 'Path Walk': 'sys.log resolved', 'Inode': '#421098' },
          microOp: 'call L3_dentry_path_walk',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff81300260', rsp: '0xffffc9000040', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 3 FS', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Layer 2: Memory & Slab Inode Cache Lookup',
          desc: 'Layer 2 checks kernel slab cache for cached inode struct and allocates page frame.',
          mode: 'Kernel Mode (Layer 2)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L3 ➔ L2)',
          isSwitch: false,
          activeNode: 'l_l2',
          orb: { x: 450, y: 259 },
          deltaCycles: COST_MODEL.MEM_PAGE_OP - 20 + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 2 (Memory Management)', 'Slab Cache': 'Alloc inode buffer', 'Translation': 'Linear kernel map' },
          microOp: 'call L2_alloc_slab_inode',
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff81400290', rsp: '0xffffc9000060', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 2 MMU', state: 'RUNNING' } }
        },
        {
          num: 5,
          title: 'Layer 1: Device Driver Metadata Read Command',
          desc: 'Layer 1 issues disk controller command to read inode sector from physical storage.',
          mode: 'Kernel Mode (Layer 1)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L2 ➔ L1)',
          isSwitch: false,
          activeNode: 'l_l1',
          orb: { x: 450, y: 329 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 1 (Device Driver)', 'Device Command': 'Read Inode Sector', 'Target': 'Layer 0' },
          microOp: 'call L1_read_inode_sector',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff81500350', rsp: '0xffffc9000080', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 1 Driver', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Layer 0: Hardware Physical Inode Fetch',
          desc: 'Physical storage reads metadata block into controller buffer and dispatches completion interrupt.',
          mode: 'Hardware Execution (Layer 0)',
          isKernel: true,
          switchText: 'Lowest Tier Execution (Layer 0)',
          isSwitch: false,
          activeNode: 'l_l0',
          orb: { x: 450, y: 412 },
          deltaCycles: COST_MODEL.DISK_IO,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 0 (Hardware & MMU)', 'Metadata': 'Inode Sector Loaded', 'IRQ': 'Dispatched' },
          microOp: 'in al, 0x20 ; IRQ complete',
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff81015090', rsp: '0xffffc9000090', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 0 Hardware', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Cascade Return (L0 ➔ L1 ➔ L2 ➔ L3 ➔ L4 ➔ L5)',
          desc: 'Results bubble upward through all 5 layers in reverse order, verifying layer invariants at each step before reaching User App.',
          mode: 'User Mode (Layer 5)',
          isKernel: false,
          switchText: '⚡ Privilege Mode Switch (L4 Kernel ➔ L5 User)',
          isSwitch: true,
          activeNode: 'l_l5',
          orb: { x: 450, y: 49 },
          deltaCycles: COST_MODEL.SYSRET + (hopCycles * 5),
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Return Cascade': 'L0 ➔ L1 ➔ L2 ➔ L3 ➔ L4 ➔ L5', 'Allocated FD': 'fd = 3', 'Return Value': 'RAX = 3' },
          microOp: 'ret ; open() returns fd=3',
          hardware: { cpl: 3, rax: '3', rip: '0x00401205', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Layer 5 Client', state: 'RUNNING' } }
        }
      ];
    } else if (syscallKey === 'fork') {
      layerStages = [
        {
          num: 1,
          title: 'Layer 5: User Application Invocation (fork)',
          desc: 'Layer 5 application invokes fork call gate to clone the current process address space.',
          mode: 'User Mode (Layer 5)',
          isKernel: false,
          switchText: 'No switch (Layer 5 User Tier)',
          isSwitch: false,
          activeNode: 'l_l5',
          orb: { x: 450, y: 49 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 5 (User App)', 'Operation': 'fork() clone', 'Parent PID': 'PID 101' },
          microOp: 'call L5_to_L4_gate ; fork()',
          hardware: { cpl: 3, rax: '0x39', rip: '0x00401300', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Layer 4: Process Descriptor Cloning',
          desc: 'Layer 4 duplicates process control block and assigns new PID 102.',
          mode: 'Kernel Mode (Layer 4)',
          isKernel: true,
          switchText: '⚡ Privilege Mode Switch (L5 User ➔ L4 Kernel)',
          isSwitch: true,
          activeNode: 'l_l4',
          orb: { x: 450, y: 119 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + hopCycles,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 4 (Process Mgmt)', 'New PID': 'PID 102', 'Privilege': 'Ring 0' },
          microOp: 'call L4_clone_pcb',
          hardware: { cpl: 0, rax: '0x39', rip: '0xffffffff81200150', rsp: '0xffffc9000020', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 3,
          title: 'Layer 3: File Descriptor Reference Duplication',
          desc: 'Layer 3 increments reference counters on all inherited open files in the file system layer.',
          mode: 'Kernel Mode (Layer 3)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L4 ➔ L3)',
          isSwitch: false,
          activeNode: 'l_l3',
          orb: { x: 450, y: 189 },
          deltaCycles: COST_MODEL.FS_INODE_OP - 20 + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 3 (File System)', 'Inherited Files': 'FD table cloned', 'Invariant': 'Calls ONLY Layer 2' },
          microOp: 'call L3_dup_fd_refs',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 0, rax: '0x39', rip: '0xffffffff81300180', rsp: '0xffffc9000040', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Layer 2: Memory & Copy-On-Write (COW) Tagging',
          desc: 'Layer 2 duplicates page tables and marks all pages Copy-On-Write.',
          mode: 'Kernel Mode (Layer 2)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L3 ➔ L2)',
          isSwitch: false,
          activeNode: 'l_l2',
          orb: { x: 450, y: 259 },
          deltaCycles: COST_MODEL.MEM_PAGE_OP * 2 + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 2 (Memory Management)', 'PTEs': 'COW write-protect', 'Child CR3': '0x1E00' },
          microOp: 'call L2_cow_page_clone',
          hardware: { cpl: 0, rax: '0x39', rip: '0xffffffff81400220', rsp: '0xffffc9000060', cr3: '0x1a00', tlb: 'MISS', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 5,
          title: 'Layer 1: Process Scheduler Queue Placement',
          desc: 'Layer 1 enqueues child process PID 102 onto the CPU runqueue for execution.',
          mode: 'Kernel Mode (Layer 1)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L2 ➔ L1)',
          isSwitch: false,
          activeNode: 'l_l1',
          orb: { x: 450, y: 329 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH + 20 + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 1 (Scheduler Driver)', 'Runqueue': 'PID 102 Enqueued', 'State': 'READY' },
          microOp: 'call L1_enqueue_task(PID_102)',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 0, rax: '0x39', rip: '0xffffffff81500250', rsp: '0xffffc9000080', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Layer 0: Hardware MMU & CPU Context Sync',
          desc: 'Physical CPU hardware registers child task control block and configures MMU address space.',
          mode: 'Hardware Execution (Layer 0)',
          isKernel: true,
          switchText: 'Lowest Tier Execution (Layer 0)',
          isSwitch: false,
          activeNode: 'l_l0',
          orb: { x: 450, y: 412 },
          deltaCycles: 180,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 0 (Hardware & MMU)', 'Hardware MMU': 'Child CR3 Synced', 'Direction': 'Bubbling return' },
          microOp: 'wrmsr IA32_KERNEL_GS_BASE',
          hardware: { cpl: 0, rax: '102', rip: '0xffffffff81015090', rsp: '0xffffc9000090', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Cascade Return (L0 ➔ L1 ➔ L2 ➔ L3 ➔ L4 ➔ L5)',
          desc: 'Results bubble upward through all 5 layers in reverse order, verifying layer invariants at each step before reaching User App.',
          mode: 'User Mode (Layer 5)',
          isKernel: false,
          switchText: '⚡ Privilege Mode Switch (L4 Kernel ➔ L5 User)',
          isSwitch: true,
          activeNode: 'l_l5',
          orb: { x: 450, y: 49 },
          deltaCycles: COST_MODEL.SYSRET + (hopCycles * 5),
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Return Cascade': 'L0 ➔ L1 ➔ L2 ➔ L3 ➔ L4 ➔ L5', 'Parent Return': 'RAX = 102 (Child PID)', 'Child Return': 'RAX = 0' },
          microOp: 'ret ; parent resumed with child PID 102',
          hardware: { cpl: 3, rax: '102', rip: '0x00401305', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        }
      ];
    } else {
      // send_message
      layerStages = [
        {
          num: 1,
          title: 'Layer 5: User Application Invocation (send_message)',
          desc: 'Layer 5 process marshals destination PID 104 and message payload token into IPC gate.',
          mode: 'User Mode (Layer 5)',
          isKernel: false,
          switchText: 'No switch (Layer 5 User Tier)',
          isSwitch: false,
          activeNode: 'l_l5',
          orb: { x: 450, y: 49 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 5 (User App)', 'Target PID': 'PID 104', 'Payload': '64 Bytes' },
          microOp: 'call L5_to_L4_gate ; send_message(104, token)',
          hardware: { cpl: 3, rax: '180', rip: '0x00401400', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Layer 4: IPC Envelope & Capability Validation',
          desc: 'Layer 4 validates capability token and verifies receiver mailbox quota.',
          mode: 'Kernel Mode (Layer 4)',
          isKernel: true,
          switchText: '⚡ Privilege Mode Switch (L5 User ➔ L4 Kernel)',
          isSwitch: true,
          activeNode: 'l_l4',
          orb: { x: 450, y: 119 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + hopCycles,
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 4 (IPC Gate)', 'Capability': 'Validated', 'Privilege': 'Ring 0' },
          microOp: 'call L4_validate_ipc_cap',
          hardware: { cpl: 0, rax: '180', rip: '0xffffffff81200190', rsp: '0xffffc9000020', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 3,
          title: 'Layer 3: Socket Channel & Endpoint Resolution',
          desc: 'Layer 3 maps message destination to receiver socket channel structure.',
          mode: 'Kernel Mode (Layer 3)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L4 ➔ L3)',
          isSwitch: false,
          activeNode: 'l_l3',
          orb: { x: 450, y: 189 },
          deltaCycles: COST_MODEL.FS_INODE_OP - 40 + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 3 (Channel Resolution)', 'Receiver': 'Mailbox 104 bound', 'Invariant': 'Calls ONLY Layer 2' },
          microOp: 'call L3_resolve_socket_channel',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 0, rax: '180', rip: '0xffffffff81300220', rsp: '0xffffc9000040', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Layer 2: Memory Ring Buffer Frame Mapping',
          desc: 'Layer 2 copies 64-byte payload into shared kernel ring buffer page.',
          mode: 'Kernel Mode (Layer 2)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L3 ➔ L2)',
          isSwitch: false,
          activeNode: 'l_l2',
          orb: { x: 450, y: 259 },
          deltaCycles: COST_MODEL.MEM_PAGE_OP - 30 + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 2 (Memory Management)', 'Buffer Action': 'Payload Copied', 'Bytes': '64 Bytes' },
          microOp: 'call L2_copy_to_ring_buffer',
          hardware: { cpl: 0, rax: '180', rip: '0xffffffff81400260', rsp: '0xffffc9000060', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 5,
          title: 'Layer 1: Inter-Processor Interrupt (IPI) Dispatch',
          desc: 'Layer 1 signals CPU interrupt to alert destination core that message is pending.',
          mode: 'Kernel Mode (Layer 1)',
          isKernel: true,
          switchText: 'Downward Layer Crossing (L2 ➔ L1)',
          isSwitch: false,
          activeNode: 'l_l1',
          orb: { x: 450, y: 329 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH - 10 + hopCycles,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 1 (Bus / IPI Driver)', 'Interrupt': 'IPI Dispatched', 'Receiver': 'Woken to READY' },
          microOp: 'call L1_send_ipi_signal',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 0, rax: '180', rip: '0xffffffff81500280', rsp: '0xffffc9000080', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Layer 0: Hardware APIC Memory Bus Transfer',
          desc: 'Physical memory bus and APIC controller complete interrupt delivery.',
          mode: 'Hardware Execution (Layer 0)',
          isKernel: true,
          switchText: 'Lowest Tier Execution (Layer 0)',
          isSwitch: false,
          activeNode: 'l_l0',
          orb: { x: 450, y: 412 },
          deltaCycles: 120,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Tier': 'Layer 0 (Hardware & MMU)', 'Bus Status': 'Transfer Complete', 'Direction': 'Bubbling return' },
          microOp: 'mov [APIC_ICR], eax ; APIC write',
          hardware: { cpl: 0, rax: '0', rip: '0xffffffff81015090', rsp: '0xffffc9000090', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Cascade Return (L0 ➔ L1 ➔ L2 ➔ L3 ➔ L4 ➔ L5)',
          desc: 'Results bubble upward through all 5 layers in reverse order, verifying layer invariants at each step before reaching User App.',
          mode: 'User Mode (Layer 5)',
          isKernel: false,
          switchText: '⚡ Privilege Mode Switch (L4 Kernel ➔ L5 User)',
          isSwitch: true,
          activeNode: 'l_l5',
          orb: { x: 450, y: 49 },
          deltaCycles: COST_MODEL.SYSRET + (hopCycles * 5),
          isModeSwitch: true,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Return Cascade': 'L0 ➔ L1 ➔ L2 ➔ L3 ➔ L4 ➔ L5', 'Return Value': 'RAX = 0 (Success)', 'Status': 'Delivered' },
          microOp: 'ret ; message sent successfully',
          hardware: { cpl: 3, rax: '0', rip: '0x00401405', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        }
      ];
    }

    // ========================================================================
    // 3. MICROKERNEL ARCHITECTURE (SYSCALL SPECIFIC)
    // ========================================================================
    let microStages = [];

    if (syscallKey === 'read') {
      microStages = [
        {
          num: 1,
          title: 'App Creates read() IPC Envelope',
          desc: 'Client Application (PID 101) marshals read request {op: READ, fd: 3, count: 4096} and calls ipc_send_rec().',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'No switch (Client preparing IPC message)',
          isSwitch: false,
          activeNode: 'u_app',
          orb: { x: 175, y: 87 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User Mode (Ring 3)', 'Active Process': 'Client App (PID 101)', 'IPC Envelope': '{op: READ, fd: 3, len: 4096}', 'Address Space': 'CR3: 0x1A00' },
          microOp: 'lea rsi, [ipc_read_envelope] ; syscall',
          hardware: { cpl: 3, rax: '0x00', rip: '0x00401050', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Microkernel Routes IPC to File Server',
          desc: 'Microkernel receives message in Ring 0, puts client to WAITING state, reloads CR3, and context switches to File Server (PID 10).',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Switch (Ring 3 ➔ 0) + Context Switch 1',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'CPU Mode': 'Ring 3 ➔ Ring 0 Broker', 'Context Switch': 'CR3: 0x1A00 ➔ 0x2B00', 'TLB Action': 'Non-global TLB flushed', 'Client State': 'WAITING (Blocked on IPC)' },
          microOp: 'mov cr3, rbx ; sysretq (File Server)',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff80001020', rsp: '0xffff80000050', cr3: '0x2b00', tlb: 'FLUSH', pcb: { pid: 101, name: 'Client App', state: 'WAITING' } }
        },
        {
          num: 3,
          title: 'File Server Processes Inode & Block Map',
          desc: 'File Server daemon runs in isolated user space (Ring 3). Reads inode metadata and prepares DISK_READ message for Driver Server.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'User Space Server Execution (Ring 3)',
          isSwitch: false,
          activeNode: 'u_fs',
          orb: { x: 450, y: 87 },
          deltaCycles: COST_MODEL.FS_INODE_OP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User Mode (Ring 3)', 'Active Process': 'File Server (PID 10)', 'Fault Isolation': 'Ring 3 isolated memory', 'Next Action': 'IPC send to Driver (PID 12)' },
          microOp: 'call fs_process_inode ; ipc_send(PID_12)',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 3, rax: '0x00', rip: '0x00412000', rsp: '0x7fffee10', cr3: '0x2b00', tlb: 'HIT', pcb: { pid: 10, name: 'File Server', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Microkernel Routes IPC to Driver Server',
          desc: 'Microkernel verifies capability token, suspends File Server, reloads CR3, and context switches to Driver Server (PID 12).',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Switch (Ring 3 ➔ 0) + Context Switch 2',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'CPU Mode': 'Kernel (Ring 0) Broker', 'Context Switch': 'CR3: 0x2B00 ➔ 0x3C00', 'TLB Action': 'Non-global TLB flushed', 'File Server': 'WAITING (Blocked on Driver)' },
          microOp: 'mov cr3, rcx ; sysretq (Driver Server)',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff80001020', rsp: '0xffff80000080', cr3: '0x3c00', tlb: 'FLUSH', pcb: { pid: 10, name: 'File Server', state: 'WAITING' } }
        },
        {
          num: 5,
          title: 'Driver Server Schedules NVMe DMA Read',
          desc: 'Disk Driver daemon in user mode (Ring 3) configures hardware DMA read commands using restricted memory-mapped I/O.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'User Space Driver Execution (Ring 3)',
          isSwitch: false,
          activeNode: 'u_driver',
          orb: { x: 725, y: 87 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User Mode (Ring 3)', 'Active Process': 'Driver Server (PID 12)', 'Fault Containment': 'Crash here CANNOT corrupt kernel', 'Device Command': 'DMA Transfer Scheduled' },
          microOp: 'out 0x1f0, al ; device strobe',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 3, rax: '0x00', rip: '0x00424000', rsp: '0x7ffff100', cr3: '0x3c00', tlb: 'HIT', pcb: { pid: 12, name: 'Driver Server', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Physical Hardware Execution & IRQ Forward',
          desc: 'Storage controller streams sectors into RAM via DMA. Interrupt is converted by microkernel into an IPC notification.',
          mode: 'Hardware Execution',
          isKernel: true,
          switchText: 'Hardware IRQ ➔ Microkernel IPC Forwarder',
          isSwitch: false,
          activeNode: 'u_hw',
          orb: { x: 450, y: 412 },
          deltaCycles: COST_MODEL.DISK_IO,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Hardware Operation': 'DMA Transaction complete', 'Hardware IRQ': 'Converted to IPC message', 'Microkernel Role': 'Forward IRQ token to Driver PID 12', 'Data Integrity': 'Isolated in private server memory' },
          microOp: 'irq_to_ipc_msg(PID_12)',
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff80002100', rsp: '0xffff800000a0', cr3: '0x3c00', tlb: 'HIT', pcb: { pid: 12, name: 'Driver Server', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Driver Replies to File Server (Context Switch 3)',
          desc: 'Driver replies via Microkernel to File Server. Microkernel reloads CR3 and context switches execution back to File Server.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Context Switch 3 (Driver ➔ File Server)',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Active Node': 'Microkernel IPC Router', 'Context Switch': 'CR3: 0x3C00 ➔ 0x2B00', 'Reply Message': '{status: OK, data: ready}', 'File Server State': 'WAITING ➔ READY' },
          microOp: 'ipc_reply(PID_10) ; mov cr3, rbx',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x00', rip: '0xffffffff80001020', rsp: '0xffff800000c0', cr3: '0x2b00', tlb: 'FLUSH', pcb: { pid: 10, name: 'File Server', state: 'READY' } }
        },
        {
          num: 8,
          title: 'File Server Replies to User App (Context Switch 4)',
          desc: 'File Server sends final reply to Client App via Microkernel. Client wakes up to RUNNING state with 4096 bytes data.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: '⚡ Context Switch 4 (File Server ➔ User App)',
          isSwitch: true,
          activeNode: 'u_app',
          orb: { x: 175, y: 87 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY + COST_MODEL.SYSRET,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Active Node': 'Client App (PID 101)', 'Context Switch': 'CR3: 0x2B00 ➔ 0x1A00', 'Client State': 'WAITING ➔ RUNNING', 'Reliability': '100% Self-Healing / Zero Kernel Downtime' },
          microOp: 'mov rax, 4096 ; client resumed',
          ipcEnvelope: true,
          hardware: { cpl: 3, rax: '4096', rip: '0x00401055', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        }
      ];
    } else if (syscallKey === 'write') {
      microStages = [
        {
          num: 1,
          title: 'App Creates write() IPC Envelope',
          desc: 'Client Application marshals write request {op: WRITE, fd: 3, len: 1024} into IPC envelope.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'No switch (Client preparing IPC message)',
          isSwitch: false,
          activeNode: 'u_app',
          orb: { x: 175, y: 87 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User Mode (Ring 3)', 'Active Process': 'Client App (PID 101)', 'IPC Envelope': '{op: WRITE, fd: 3, len: 1024}', 'Address Space': 'CR3: 0x1A00' },
          microOp: 'lea rsi, [ipc_write_envelope] ; syscall',
          hardware: { cpl: 3, rax: '0x01', rip: '0x00401120', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Microkernel Routes IPC to File Server',
          desc: 'Microkernel delivers write IPC envelope to File Server (PID 10) and unblocks server thread.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Switch (Ring 3 ➔ 0) + Context Switch 1',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'CPU Mode': 'Ring 3 ➔ Ring 0 Broker', 'Context Switch': 'CR3: 0x1A00 ➔ 0x2B00', 'TLB Action': 'Non-global TLB flushed' },
          microOp: 'mov cr3, rbx ; sysretq (File Server)',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff80001020', rsp: '0xffff80000050', cr3: '0x2b00', tlb: 'FLUSH', pcb: { pid: 101, name: 'Client App', state: 'WAITING' } }
        },
        {
          num: 3,
          title: 'File Server Logs Dirty Block Transaction',
          desc: 'File Server verifies write permissions, logs metadata transaction, and requests disk write from Driver.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'User Space Server Execution (Ring 3)',
          isSwitch: false,
          activeNode: 'u_fs',
          orb: { x: 450, y: 87 },
          deltaCycles: COST_MODEL.FS_INODE_OP + 40,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User Mode (Ring 3)', 'Active Process': 'File Server (PID 10)', 'Transaction': 'Dirty block allocated', 'Next': 'IPC to Driver PID 12' },
          microOp: 'call fs_log_dirty_block ; ipc_send(PID_12)',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 3, rax: '0x01', rip: '0x00412150', rsp: '0x7fffee10', cr3: '0x2b00', tlb: 'HIT', pcb: { pid: 10, name: 'File Server', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Microkernel Routes IPC to Driver Server',
          desc: 'Microkernel context switches CR3 from File Server to Driver Server (PID 12).',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Switch (Ring 3 ➔ 0) + Context Switch 2',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Context Switch': 'CR3: 0x2B00 ➔ 0x3C00', 'Target': 'Driver Server (PID 12)' },
          microOp: 'mov cr3, rcx ; sysretq (Driver Server)',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff80001020', rsp: '0xffff80000080', cr3: '0x3c00', tlb: 'FLUSH', pcb: { pid: 10, name: 'File Server', state: 'WAITING' } }
        },
        {
          num: 5,
          title: 'Driver Server Dispatches NVMe Flush Command',
          desc: 'Driver Server configures DMA writeback registers to stream buffer to physical flash memory.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'User Space Driver Execution (Ring 3)',
          isSwitch: false,
          activeNode: 'u_driver',
          orb: { x: 725, y: 87 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH + 10,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Driver Action': 'DMA Write Command', 'Process': 'Driver Server PID 12', 'Fault Isolation': 'Ring 3 isolated' },
          microOp: 'out 0x1f7, al ; DMA write strobe',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 3, rax: '0x01', rip: '0x00424100', rsp: '0x7ffff100', cr3: '0x3c00', tlb: 'HIT', pcb: { pid: 12, name: 'Driver Server', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Physical Storage Hardware Flash Commit',
          desc: 'Physical storage hardware writes 1024 bytes to NAND flash cells and raises hardware IRQ.',
          mode: 'Hardware Execution',
          isKernel: true,
          switchText: 'Hardware Flash Write & IRQ Forward',
          isSwitch: false,
          activeNode: 'u_hw',
          orb: { x: 450, y: 412 },
          deltaCycles: COST_MODEL.DISK_IO,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Hardware Media': 'NAND Flash Programmed', 'IRQ': 'Dispatched to Microkernel' },
          microOp: 'in al, 0x20 ; IRQ complete',
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff80002100', rsp: '0xffff800000a0', cr3: '0x3c00', tlb: 'HIT', pcb: { pid: 12, name: 'Driver Server', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Driver Replies to File Server (Context Switch 3)',
          desc: 'Driver notifies File Server that write is committed to non-volatile storage.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Context Switch 3 (Driver ➔ File Server)',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Context Switch': 'CR3: 0x3C00 ➔ 0x2B00', 'Status': 'Write Committed' },
          microOp: 'ipc_reply(PID_10) ; mov cr3, rbx',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x01', rip: '0xffffffff80001020', rsp: '0xffff800000c0', cr3: '0x2b00', tlb: 'FLUSH', pcb: { pid: 10, name: 'File Server', state: 'READY' } }
        },
        {
          num: 8,
          title: 'File Server Replies to User App (Context Switch 4)',
          desc: 'File Server returns write success status (1024 bytes written) to client application.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: '⚡ Context Switch 4 (File Server ➔ User App)',
          isSwitch: true,
          activeNode: 'u_app',
          orb: { x: 175, y: 87 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY + COST_MODEL.SYSRET,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Return Value': 'RAX = 1024 Bytes', 'Client State': 'RUNNING', 'Reliability': '100% Self-Healing' },
          microOp: 'mov rax, 1024 ; write complete',
          ipcEnvelope: true,
          hardware: { cpl: 3, rax: '1024', rip: '0x00401125', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        }
      ];
    } else if (syscallKey === 'open') {
      microStages = [
        {
          num: 1,
          title: 'App Creates open() IPC Envelope',
          desc: 'Client Application marshals path string "/var/log/sys.log" into IPC envelope.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'No switch (Client preparing IPC message)',
          isSwitch: false,
          activeNode: 'u_app',
          orb: { x: 175, y: 87 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User Mode (Ring 3)', 'Active Process': 'Client App (PID 101)', 'IPC Envelope': '{op: OPEN, path: "/var/log/sys.log"}', 'Address Space': 'CR3: 0x1A00' },
          microOp: 'lea rsi, [ipc_open_envelope] ; syscall',
          hardware: { cpl: 3, rax: '0x02', rip: '0x00401200', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Microkernel Routes IPC to File Server',
          desc: 'Microkernel transfers path envelope to File Server (PID 10) and context switches CR3.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Switch (Ring 3 ➔ 0) + Context Switch 1',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'CPU Mode': 'Ring 3 ➔ Ring 0 Broker', 'Context Switch': 'CR3: 0x1A00 ➔ 0x2B00' },
          microOp: 'mov cr3, rbx ; sysretq (File Server)',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff80001020', rsp: '0xffff80000050', cr3: '0x2b00', tlb: 'FLUSH', pcb: { pid: 101, name: 'Client App', state: 'WAITING' } }
        },
        {
          num: 3,
          title: 'File Server Resolves Path Dentry',
          desc: 'File Server walks path tokens in user mode (Ring 3) and determines sector location for inode #421098.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'User Space Server Execution (Ring 3)',
          isSwitch: false,
          activeNode: 'u_fs',
          orb: { x: 450, y: 87 },
          deltaCycles: COST_MODEL.FS_INODE_OP + 20,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Process': 'File Server PID 10', 'Path Walk': 'sys.log located', 'Target': 'Sector 0x7e00' },
          microOp: 'call fs_lookup_dentry ; ipc_send(PID_12)',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 3, rax: '0x02', rip: '0x00412200', rsp: '0x7fffee10', cr3: '0x2b00', tlb: 'HIT', pcb: { pid: 10, name: 'File Server', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Microkernel Routes IPC to Driver Server',
          desc: 'Microkernel context switches execution to Driver Server (PID 12).',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Switch (Ring 3 ➔ 0) + Context Switch 2',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Context Switch': 'CR3: 0x2B00 ➔ 0x3C00' },
          microOp: 'mov cr3, rcx ; sysretq (Driver Server)',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff80001020', rsp: '0xffff80000080', cr3: '0x3c00', tlb: 'FLUSH', pcb: { pid: 10, name: 'File Server', state: 'WAITING' } }
        },
        {
          num: 5,
          title: 'Driver Server Reads Inode Sector',
          desc: 'Driver Server in user mode sets up controller DMA to fetch directory sector from disk.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'User Space Driver Execution (Ring 3)',
          isSwitch: false,
          activeNode: 'u_driver',
          orb: { x: 725, y: 87 },
          deltaCycles: COST_MODEL.DRIVER_DISPATCH,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Process': 'Driver Server PID 12', 'Command': 'Read Sector 0x7e00' },
          microOp: 'out 0x1f0, al ; read metadata',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 3, rax: '0x02', rip: '0x00424200', rsp: '0x7ffff100', cr3: '0x3c00', tlb: 'HIT', pcb: { pid: 12, name: 'Driver Server', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Physical Storage Hardware Transfer',
          desc: 'Disk controller transfers inode metadata block to memory and signals interrupt.',
          mode: 'Hardware Execution',
          isKernel: true,
          switchText: 'Hardware DMA & IRQ Forward',
          isSwitch: false,
          activeNode: 'u_hw',
          orb: { x: 450, y: 412 },
          deltaCycles: COST_MODEL.DISK_IO,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Hardware': 'Disk Controller', 'Status': 'Inode Loaded' },
          microOp: 'in al, 0x20 ; IRQ complete',
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff80002100', rsp: '0xffff800000a0', cr3: '0x3c00', tlb: 'HIT', pcb: { pid: 12, name: 'Driver Server', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Driver Replies to File Server (Context Switch 3)',
          desc: 'Driver Server forwards inode struct data back to File Server.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Context Switch 3 (Driver ➔ File Server)',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Context Switch': 'CR3: 0x3C00 ➔ 0x2B00', 'File Server': 'Allocates FD token' },
          microOp: 'ipc_reply(PID_10) ; mov cr3, rbx',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x02', rip: '0xffffffff80001020', rsp: '0xffff800000c0', cr3: '0x2b00', tlb: 'FLUSH', pcb: { pid: 10, name: 'File Server', state: 'READY' } }
        },
        {
          num: 8,
          title: 'File Server Replies to User App (Context Switch 4)',
          desc: 'File Server returns allocated file handle token (fd=3) to client application.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: '⚡ Context Switch 4 (File Server ➔ User App)',
          isSwitch: true,
          activeNode: 'u_app',
          orb: { x: 175, y: 87 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY + COST_MODEL.SYSRET,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Allocated FD': 'fd = 3', 'Return Value': 'RAX = 3', 'Client': 'RUNNING' },
          microOp: 'mov rax, 3 ; open() complete',
          ipcEnvelope: true,
          hardware: { cpl: 3, rax: '3', rip: '0x00401205', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        }
      ];
    } else if (syscallKey === 'fork') {
      microStages = [
        {
          num: 1,
          title: 'App Creates fork() IPC Envelope',
          desc: 'Parent application (PID 101) invokes Microkernel to spawn child process via Process Server.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'No switch (Client preparing IPC message)',
          isSwitch: false,
          activeNode: 'u_app',
          orb: { x: 175, y: 87 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User Mode (Ring 3)', 'Parent PID': 'PID 101', 'IPC Envelope': '{op: FORK_CLONE}' },
          microOp: 'lea rsi, [ipc_fork_envelope] ; syscall',
          hardware: { cpl: 3, rax: '0x39', rip: '0x00401300', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Microkernel Routes IPC to Process Server',
          desc: 'Microkernel routes request to user-space Process Server daemon (PID 10) to allocate task structures.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Switch (Ring 3 ➔ 0) + Context Switch 1',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Context Switch': 'CR3: 0x1A00 ➔ 0x2B00', 'Target': 'Process Server PID 10' },
          microOp: 'mov cr3, rbx ; sysretq (Process Server)',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x39', rip: '0xffffffff80001020', rsp: '0xffff80000050', cr3: '0x2b00', tlb: 'FLUSH', pcb: { pid: 101, name: 'Parent App', state: 'WAITING' } }
        },
        {
          num: 3,
          title: 'Process Server Allocates PID 102 & Clones Context',
          desc: 'Process Server allocates new task identifier PID 102, copies process metadata, and contacts Memory Server.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'User Space Server Execution (Ring 3)',
          isSwitch: false,
          activeNode: 'u_fs',
          orb: { x: 450, y: 87 },
          deltaCycles: 180,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Active Server': 'Process Server (PID 10)', 'Allocated PID': 'PID 102', 'Next': 'IPC to Memory Server' },
          microOp: 'call pm_clone_task ; ipc_send(PID_12)',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 3, rax: '0x39', rip: '0x00412300', rsp: '0x7fffee10', cr3: '0x2b00', tlb: 'HIT', pcb: { pid: 10, name: 'Process Server', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Microkernel Routes IPC to Memory Server',
          desc: 'Microkernel context switches to user-space Memory Server daemon (PID 12).',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Switch (Ring 3 ➔ 0) + Context Switch 2',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Context Switch': 'CR3: 0x2B00 ➔ 0x3C00', 'Target': 'Memory Server PID 12' },
          microOp: 'mov cr3, rcx ; sysretq (Memory Server)',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x39', rip: '0xffffffff80001020', rsp: '0xffff80000080', cr3: '0x3c00', tlb: 'FLUSH', pcb: { pid: 10, name: 'Process Server', state: 'WAITING' } }
        },
        {
          num: 5,
          title: 'Memory Server Clones Address Space & Tags COW',
          desc: 'Memory Server duplicates address space mappings and tags user memory pages as Copy-On-Write.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'User Space Driver Execution (Ring 3)',
          isSwitch: false,
          activeNode: 'u_driver',
          orb: { x: 725, y: 87 },
          deltaCycles: 260,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Memory Server': 'PID 12', 'Pages': 'Marked COW', 'Child CR3': 'Allocated: 0x1E00' },
          microOp: 'call vm_fork_cow ; tag pages',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 3, rax: '0x39', rip: '0x00424300', rsp: '0x7ffff100', cr3: '0x3c00', tlb: 'MISS', pcb: { pid: 12, name: 'Memory Server', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Hardware MMU Registers Child Address Space',
          desc: 'Hardware MMU syncs child page table roots and microkernel queues child to runnable pool.',
          mode: 'Hardware Execution',
          isKernel: true,
          switchText: 'Hardware MMU / APIC Sync',
          isSwitch: false,
          activeNode: 'u_hw',
          orb: { x: 450, y: 412 },
          deltaCycles: 180,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'MMU State': 'CR3 0x1E00 Registered', 'Child State': 'READY' },
          microOp: 'wrmsr IA32_KERNEL_GS_BASE',
          hardware: { cpl: 0, rax: '102', rip: '0xffffffff80002100', rsp: '0xffff800000a0', cr3: '0x3c00', tlb: 'HIT', pcb: { pid: 12, name: 'Memory Server', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Memory Server Replies to Process Server (Context Switch 3)',
          desc: 'Memory Server acknowledges page table setup complete to Process Server.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Context Switch 3 (Memory ➔ Process Server)',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Context Switch': 'CR3: 0x3C00 ➔ 0x2B00', 'Status': 'VM Setup Complete' },
          microOp: 'ipc_reply(PID_10) ; mov cr3, rbx',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0x39', rip: '0xffffffff80001020', rsp: '0xffff800000c0', cr3: '0x2b00', tlb: 'FLUSH', pcb: { pid: 10, name: 'Process Server', state: 'READY' } }
        },
        {
          num: 8,
          title: 'Process Server Replies to Parent App (Context Switch 4)',
          desc: 'Process Server returns new child PID 102 to parent process.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: '⚡ Context Switch 4 (Process Server ➔ Parent App)',
          isSwitch: true,
          activeNode: 'u_app',
          orb: { x: 175, y: 87 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY + COST_MODEL.SYSRET,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Parent RAX': '102 (Child PID)', 'Child RAX': '0 (Ready to run)', 'Reliability': '100% Self-Healing' },
          microOp: 'mov rax, 102 ; fork() complete',
          ipcEnvelope: true,
          hardware: { cpl: 3, rax: '102', rip: '0x00401305', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Parent App', state: 'RUNNING' } }
        }
      ];
    } else {
      // send_message
      microStages = [
        {
          num: 1,
          title: 'App Creates send_message() IPC Envelope',
          desc: 'Sender Application (PID 101) marshals destination PID 104 and capability token into envelope.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'No switch (Client preparing IPC message)',
          isSwitch: false,
          activeNode: 'u_app',
          orb: { x: 175, y: 87 },
          deltaCycles: COST_MODEL.APP_PREP,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'CPU Mode': 'User Mode (Ring 3)', 'Target PID': 'PID 104', 'IPC Envelope': '{dest: 104, cap: 0xAF40}' },
          microOp: 'lea rsi, [ipc_msg_envelope] ; syscall',
          hardware: { cpl: 3, rax: '180', rip: '0x00401400', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        },
        {
          num: 2,
          title: 'Microkernel Routes IPC to Name Server',
          desc: 'Microkernel routes capability lookup to user-space Name / Endpoint Server (PID 10).',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Switch (Ring 3 ➔ 0) + Context Switch 1',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Context Switch': 'CR3: 0x1A00 ➔ 0x2B00', 'Target': 'Name Server PID 10' },
          microOp: 'mov cr3, rbx ; sysretq (Name Server)',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '180', rip: '0xffffffff80001020', rsp: '0xffff80000050', cr3: '0x2b00', tlb: 'FLUSH', pcb: { pid: 101, name: 'Client App', state: 'WAITING' } }
        },
        {
          num: 3,
          title: 'Name Server Resolves Mailbox Endpoint',
          desc: 'Name Server validates destination PID 104 rights and generates authorization ticket for direct IPC.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'User Space Server Execution (Ring 3)',
          isSwitch: false,
          activeNode: 'u_fs',
          orb: { x: 450, y: 87 },
          deltaCycles: 70,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Name Server': 'PID 10', 'Validation': 'Authorized', 'Ticket': 'Capability Token Verified' },
          microOp: 'call ns_resolve_endpoint(PID_104)',
          faultCandidate: 'fs_crash',
          hardware: { cpl: 3, rax: '180', rip: '0x00412400', rsp: '0x7fffee10', cr3: '0x2b00', tlb: 'HIT', pcb: { pid: 10, name: 'Name Server', state: 'RUNNING' } }
        },
        {
          num: 4,
          title: 'Microkernel Routes IPC to Destination Process',
          desc: 'Microkernel context switches directly to destination process address space (PID 104).',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Privilege Switch (Ring 3 ➔ 0) + Context Switch 2',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Context Switch': 'CR3: 0x2B00 ➔ 0x3C00', 'Target': 'Receiver App PID 104' },
          microOp: 'mov cr3, rcx ; sysretq (Receiver)',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '180', rip: '0xffffffff80001020', rsp: '0xffff80000080', cr3: '0x3c00', tlb: 'FLUSH', pcb: { pid: 10, name: 'Name Server', state: 'WAITING' } }
        },
        {
          num: 5,
          title: 'Receiver Process Consumes IPC Payload',
          desc: 'Receiver task (PID 104) wakes from WAITING state and reads payload token into buffer.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: 'User Space Driver Execution (Ring 3)',
          isSwitch: false,
          activeNode: 'u_driver',
          orb: { x: 725, y: 87 },
          deltaCycles: 60,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Receiver PID': 'PID 104', 'State': 'RUNNING', 'Payload': 'Received 64 Bytes' },
          microOp: 'call ipc_read_payload',
          faultCandidate: 'driver_crash',
          hardware: { cpl: 3, rax: '0', rip: '0x00424400', rsp: '0x7ffff100', cr3: '0x3c00', tlb: 'HIT', pcb: { pid: 104, name: 'Receiver App', state: 'RUNNING' } }
        },
        {
          num: 6,
          title: 'Physical Hardware Memory Bus Payload Sync',
          desc: 'CPU memory bus completes cache coherent transfer between process address spaces.',
          mode: 'Hardware Execution',
          isKernel: true,
          switchText: 'Hardware Memory Bus Transfer',
          isSwitch: false,
          activeNode: 'u_hw',
          orb: { x: 450, y: 412 },
          deltaCycles: 120,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          diff: { 'Hardware': 'Cache Coherent Bus', 'Status': 'Payload Transferred' },
          microOp: 'rep movsq ; hardware memory copy',
          hardware: { cpl: 0, rax: '0', rip: '0xffffffff80002100', rsp: '0xffff800000a0', cr3: '0x3c00', tlb: 'HIT', pcb: { pid: 104, name: 'Receiver App', state: 'RUNNING' } }
        },
        {
          num: 7,
          title: 'Receiver Acknowledges via Microkernel (Context Switch 3)',
          desc: 'Receiver process calls ipc_reply() to acknowledge receipt of message token.',
          mode: 'Kernel Mode (Ring 0)',
          isKernel: true,
          switchText: '⚡ Context Switch 3 (Receiver ➔ Microkernel)',
          isSwitch: true,
          activeNode: 'u_core',
          orb: { x: 450, y: 260 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Context Switch': 'CR3: 0x3C00 ➔ 0x1A00', 'Status': 'Delivery Confirmed' },
          microOp: 'ipc_reply(PID_101) ; mov cr3, rax',
          ipcEnvelope: true,
          hardware: { cpl: 0, rax: '0', rip: '0xffffffff80001020', rsp: '0xffff800000c0', cr3: '0x1a00', tlb: 'FLUSH', pcb: { pid: 104, name: 'Receiver App', state: 'READY' } }
        },
        {
          num: 8,
          title: 'Sender App Resumes with Status OK (Context Switch 4)',
          desc: 'Microkernel unblocks sender application (PID 101) and returns success code 0 in RAX.',
          mode: 'User Mode (Ring 3)',
          isKernel: false,
          switchText: '⚡ Context Switch 4 (Microkernel ➔ Sender App)',
          isSwitch: true,
          activeNode: 'u_app',
          orb: { x: 175, y: 87 },
          deltaCycles: COST_MODEL.SYSCALL_TRAP + COST_MODEL.CTX_SWITCH + COST_MODEL.TLB_MISS_FLUSH + COST_MODEL.IPC_COPY + COST_MODEL.SYSRET,
          isModeSwitch: true,
          isCtxSwitch: true,
          isIpcMessage: true,
          diff: { 'Sender PID': 'PID 101', 'Return Value': 'RAX = 0 (OK)', 'Reliability': '100% Self-Healing' },
          microOp: 'mov rax, 0 ; send_message() complete',
          ipcEnvelope: true,
          hardware: { cpl: 3, rax: '0', rip: '0x00401405', rsp: '0x7fffde20', cr3: '0x1a00', tlb: 'HIT', pcb: { pid: 101, name: 'Client App', state: 'RUNNING' } }
        }
      ];
    }

    return {
      monolithic: monoStages,
      layered: layerStages,
      microkernel: microStages
    };
  }

  /* ==========================================================================
     3. DETERMINISTIC SIMULATION ENGINE (STATE MACHINE)
     ========================================================================== */
  class AbstractSimulationEngine {
    constructor() {
      this.currentSyscall = 'read';
      this.currentArch = 'monolithic'; // 'monolithic' | 'layered' | 'microkernel' | 'compare'
      this.stageIndex = 0;
      this.isPlaying = false;
      this.playSpeed = 800; // ms
      this.playTimer = null;

      this.currentFault = null; // 'driver_crash' | 'fs_crash' | null
      this.faultTriggered = false;
      this.faultRecovered = false;
      this.recoveringNode = null;

      // State History Stack for full deterministic Step Back
      this.historyStack = [];

      this.rebuildStages();
    }

    rebuildStages() {
      this.allStages = buildArchitectureStages(this.currentSyscall);
      this.stages = this.currentArch === 'compare'
        ? this.buildCompareStages()
        : this.allStages[this.currentArch];
    }

    buildCompareStages() {
      const m = this.allStages.monolithic;
      const l = this.allStages.layered;
      const u = this.allStages.microkernel;
      const maxLen = Math.max(m.length, l.length, u.length);
      const synced = [];

      for (let i = 0; i < maxLen; i++) {
        // Monolithic / Layered halt at their first faulting stage; Microkernel heals and continues
        const firstFault = (arr) => this.currentFault ? arr.findIndex(s => s.faultCandidate === this.currentFault) : -1;
        const mFault = firstFault(m), lFault = firstFault(l), uFault = firstFault(u);
        const mi = (mFault !== -1) ? Math.min(i, m.length - 1, mFault) : Math.min(i, m.length - 1);
        const li = (lFault !== -1) ? Math.min(i, l.length - 1, lFault) : Math.min(i, l.length - 1);
        const ui = Math.min(i, u.length - 1);
        const mMetrics = computeCumulativeMetrics(m, mi);
        const lMetrics = computeCumulativeMetrics(l, li);
        const uMetrics = computeCumulativeMetrics(u, ui, uFault !== -1 && ui >= uFault);
        const mStage = m[mi];
        const lStage = l[li];
        const uStage = u[ui];

        synced.push({
          num: i + 1,
          title: `Synchronized Stage ${i + 1}: Multi-Architecture Race`,
          desc: `Comparing request packet progression through Monolithic, Layered, and Microkernel simultaneously.`,
          mode: 'Synchronized Comparison',
          isKernel: uStage.isKernel,
          switchText: `Multi-architecture progression (Hop ${i + 1})`,
          isSwitch: uStage.isSwitch,
          activeNode: 'compare_stage',
          orb: { x: 450, y: 240 },
          deltaCycles: 0,
          isModeSwitch: false,
          isCtxSwitch: false,
          isIpcMessage: false,
          counters: {
            cycles: mMetrics.cycles + lMetrics.cycles + uMetrics.cycles,
            modeSwitches: mMetrics.modeSwitches + lMetrics.modeSwitches + uMetrics.modeSwitches,
            ctxSwitches: uMetrics.ctxSwitches,
            ipc: uMetrics.ipc,
            layers: i + 1
          },
          diff: {
            'Monolithic': `${mStage.title} (${mMetrics.cycles}c)`,
            'Layered': `${lStage.title} (${lMetrics.cycles}c)`,
            'Microkernel': `${uStage.title} (${uMetrics.cycles}c)`,
            'Active Fault': this.currentFault ? this.currentFault.replace('_', ' ').toUpperCase() : 'None'
          },
          microOp: mStage.microOp,
          hardware: uStage.hardware,
          mStage,
          lStage,
          uStage,
          mMetrics,
          lMetrics,
          uMetrics
        });
      }
      return synced;
    }

    setSyscall(key) {
      if (!Syscalls[key]) return;
      this.currentSyscall = key;
      this.reset();
    }

    setArchitecture(arch) {
      this.currentArch = arch;
      this.reset();
    }

    injectFault(faultType) {
      this.currentFault = faultType;
      this.faultTriggered = false;
      this.faultRecovered = false;
      this.recoveringNode = null;
      this.rebuildStages(); // compare-mode stages depend on the active fault
      this.checkFaultAtCurrentStage();
      this.render();
    }

    clearFault() {
      this.currentFault = null;
      this.faultTriggered = false;
      this.faultRecovered = false;
      this.recoveringNode = null;
      this.rebuildStages();
      this.render();
    }

    getCurrentStage() {
      if (!this.stages || this.stages.length === 0) return null;
      return this.stages[Math.min(this.stageIndex, this.stages.length - 1)];
    }

    checkFaultAtCurrentStage() {
      const cur = this.getCurrentStage();
      if (!this.currentFault || !cur) return;

      if (cur.faultCandidate === this.currentFault) {
        if (this.currentArch === 'microkernel') {
          // Self-healing recovery: auto-restart server without halting!
          this.faultRecovered = true;
          this.recoveringNode = cur.activeNode;
          this.faultTriggered = false; // Do NOT get stuck!
        } else {
          this.faultTriggered = true;
          this.pause();
        }
      }
    }

    stepForward() {
      if (this.stageIndex >= this.stages.length - 1) {
        this.pause();
        return;
      }

      // If halted by unrecoverable fault in Monolithic or Layered, do not advance
      if (this.faultTriggered && (this.currentArch === 'monolithic' || this.currentArch === 'layered')) {
        this.pause();
        return;
      }

      // Save deep snapshot into history stack for deterministic Step Back
      this.saveSnapshot();

      this.stageIndex++;
      const nextStage = this.getCurrentStage();

      // Check if fault hits at newly reached stage
      if (this.currentFault && nextStage && nextStage.faultCandidate === this.currentFault) {
        if (this.currentArch === 'microkernel') {
          // Self-healing recovery: mark recovered, add 1500 cycles, and do NOT block!
          this.faultRecovered = true;
          this.recoveringNode = nextStage.activeNode;
          this.faultTriggered = false; // Remains non-stuck!
        } else {
          this.faultTriggered = true;
          this.pause();
        }
      }

      this.render();
    }

    stepBackward() {
      if (this.historyStack.length === 0) return;
      const snap = this.historyStack.pop();
      this.restoreSnapshot(snap);
      this.render();
    }

    jumpToStage(idx) {
      if (idx < 0 || idx >= this.stages.length) return;
      this.saveSnapshot();
      this.stageIndex = idx;
      this.faultTriggered = false;
      this.faultRecovered = false;
      this.recoveringNode = null;

      // Check if any stage up to idx encountered the fault
      if (this.currentFault) {
        for (let i = 0; i <= idx; i++) {
          const s = this.stages[i];
          if (s && s.faultCandidate === this.currentFault) {
            if (this.currentArch === 'microkernel') {
              this.faultRecovered = true;
              this.recoveringNode = s.activeNode;
            } else {
              // Monolithic / Layered cannot get past a crash: halt at the first faulting stage
              this.stageIndex = i;
              this.faultTriggered = true;
              this.pause();
              break;
            }
          }
        }
      }

      this.render();
    }

    saveSnapshot() {
      const snap = {
        stageIndex: this.stageIndex,
        faultTriggered: this.faultTriggered,
        faultRecovered: this.faultRecovered,
        recoveringNode: this.recoveringNode
      };
      this.historyStack.push(snap);
    }

    restoreSnapshot(snap) {
      this.stageIndex = snap.stageIndex;
      this.faultTriggered = snap.faultTriggered;
      this.faultRecovered = snap.faultRecovered;
      this.recoveringNode = snap.recoveringNode;
    }

    play() {
      if (this.isPlaying) return;
      this.isPlaying = true;
      document.querySelector('.play-icon').classList.add('hide');
      document.querySelector('.pause-icon').classList.remove('hide');
      document.getElementById('play-btn-text').textContent = 'Pause';

      const loop = () => {
        if (!this.isPlaying) return;
        if (this.stageIndex < this.stages.length - 1 && !this.faultTriggered) {
          this.stepForward();
          this.playTimer = setTimeout(loop, this.playSpeed);
        } else {
          this.pause();
        }
      };

      this.playTimer = setTimeout(loop, this.playSpeed);
    }

    pause() {
      this.isPlaying = false;
      if (this.playTimer) clearTimeout(this.playTimer);
      document.querySelector('.play-icon').classList.remove('hide');
      document.querySelector('.pause-icon').classList.add('hide');
      document.getElementById('play-btn-text').textContent = 'Play';
    }

    reset() {
      this.pause();
      this.stageIndex = 0;
      this.faultTriggered = false;
      this.faultRecovered = false;
      this.recoveringNode = null;
      this.historyStack = [];
      this.rebuildStages();
      this.render();
    }

    render() {
      UIController.render(this);
    }
  }

  /* ==========================================================================
     4. ABSTRACT SVG STAGE RENDERER (ROUNDED GLASS NODES + GLOWING ORB)
     ========================================================================== */
  const AbstractStageRenderer = {
    render(svgEl, engine) {
      const connLayer = svgEl.querySelector('#svg-connectors-layer');
      const nodeLayer = svgEl.querySelector('#svg-nodes-layer');
      const overlayLayer = svgEl.querySelector('#svg-overlays-layer');
      const orb = svgEl.querySelector('#request-orb');

      connLayer.innerHTML = '';
      nodeLayer.innerHTML = '';
      overlayLayer.innerHTML = '';

      const arch = engine.currentArch;
      const stage = engine.getCurrentStage();

      if (arch === 'monolithic') {
        this.renderMonolithic(connLayer, nodeLayer, overlayLayer, orb, stage, engine);
      } else if (arch === 'layered') {
        this.renderLayered(connLayer, nodeLayer, overlayLayer, orb, stage, engine);
      } else if (arch === 'microkernel') {
        this.renderMicrokernel(connLayer, nodeLayer, overlayLayer, orb, stage, engine);
      } else {
        this.renderCompare(connLayer, nodeLayer, overlayLayer, orb, stage, engine);
      }
    },

    renderMonolithic(connLayer, nodeLayer, overlayLayer, orb, stage, engine) {
      const nodes = NodeLayouts.monolithic;
      const activeId = stage ? stage.activeNode : 'node_app';
      const isPanic = engine.faultTriggered;

      // Draw Glowing Connectors
      const paths = [
        'M 400 80 L 500 80',            // App to Trap
        'M 610 110 L 610 165',          // Trap to Kernel Container
        'M 260 225 L 260 190',          // VFS internal
        'M 340 252 L 370 252',          // VFS to FS
        'M 530 252 L 560 252',          // FS to Driver
        'M 640 280 L 640 340 L 450 395' // Driver to Hardware
      ];
      connLayer.innerHTML = paths.map(p => `<path d="${p}" class="connector-line ${stage && stage.isKernel ? 'kernel-path' : ''} active-path"/>`).join('');

      // Draw Nodes
      nodes.forEach(n => {
        if (n.type === 'kernel-box') {
          // Big Frosted Unified Kernel Container
          nodeLayer.innerHTML += `
            <g class="kernel-container-group">
              <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="20" fill="rgba(192, 132, 252, 0.05)" stroke="${isPanic ? 'var(--neon-red)' : 'rgba(192, 132, 252, 0.3)'}" stroke-width="${isPanic ? '2.5' : '1.5'}" stroke-dasharray="${isPanic ? 'none' : '6 6'}" filter="url(#node-shadow)"/>
              <text x="${n.x + 20}" y="${n.y + 30}" fill="${isPanic ? 'var(--neon-red)' : 'var(--neon-purple)'}" font-size="12" font-weight="800" letter-spacing="0.05em">${isPanic ? '💥 FATAL KERNEL PANIC (RING 0 HALTED)' : 'UNIFIED SUPERVISOR KERNEL (RING 0)'}</text>
              <text x="${n.x + 20}" y="${n.y + 48}" fill="var(--text-muted)" font-size="10">Single Shared Address Space • Direct C In-Memory Function Calls</text>
            </g>
          `;
          return;
        }

        const isActive = activeId === n.id;
        // Fix the bug: crashed node strictly matches currentFault!
        const isCrashed = isPanic && (
          (engine.currentFault === 'fs_crash' && n.id === 'node_fs') ||
          (engine.currentFault === 'driver_crash' && n.id === 'node_driver')
        );

        nodeLayer.innerHTML += `
          <g class="node-group" data-id="${n.id}">
            <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" class="glass-node node-${n.type} ${isActive ? 'node-active' : ''} ${isCrashed ? 'node-crashed' : ''} ${n.type === 'kernel' && isActive ? 'kernel-active' : ''}"/>
            <text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 - 2}" fill="var(--text-main)" text-anchor="middle" font-size="13" font-weight="700">${isCrashed ? '💥 CRASHED' : n.title}</text>
            <text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 16}" fill="${n.type === 'user' ? 'var(--neon-cyan)' : (n.type === 'hardware' ? 'var(--neon-green)' : 'var(--neon-purple)')}" text-anchor="middle" font-size="10" font-weight="600">${n.sub}</text>
          </g>
        `;
      });

      // Position Request Orb
      if (stage && stage.orb) {
        orb.classList.remove('hide');
        orb.setAttribute('cx', stage.orb.x);
        orb.setAttribute('cy', stage.orb.y);
        orb.className.baseVal = `request-orb ${stage.isKernel ? 'kernel-orb' : ''}`;
      }
    },

    renderLayered(connLayer, nodeLayer, overlayLayer, orb, stage, engine) {
      const nodes = NodeLayouts.layered;
      const activeId = stage ? stage.activeNode : 'l_l5';
      const isFault = engine.faultTriggered;

      // Draw Vertical Connecting Spine
      let spine = '';
      for (let i = 0; i < nodes.length - 1; i++) {
        spine += `<line x1="450" y1="${nodes[i].y + nodes[i].h}" x2="450" y2="${nodes[i+1].y}" class="connector-line active-path"/>`;
      }
      connLayer.innerHTML = spine;

      // Draw Layers
      nodes.forEach(n => {
        const isActive = activeId === n.id;
        const isCrashed = isFault && (
          (engine.currentFault === 'fs_crash' && n.id === 'l_l3') ||
          (engine.currentFault === 'driver_crash' && n.id === 'l_l1')
        );

        nodeLayer.innerHTML += `
          <g class="node-group" data-id="${n.id}">
            <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" class="glass-node node-${n.type} ${isActive ? 'node-active' : ''} ${isCrashed ? 'node-crashed' : ''} ${n.type === 'kernel' && isActive ? 'kernel-active' : ''}"/>
            <text x="${n.x + 20}" y="${n.y + n.h / 2 + 5}" fill="var(--text-main)" font-size="13" font-weight="700">${isCrashed ? '💥 LAYER HALTED BY ASSERTION' : n.title}</text>
            <text x="${n.x + n.w - 20}" y="${n.y + n.h / 2 + 5}" fill="${n.type === 'user' ? 'var(--neon-cyan)' : 'var(--neon-purple)'}" text-anchor="end" font-size="11" font-weight="600">${n.sub}</text>
            <rect x="${n.x + n.w + 15}" y="${n.y + 12}" width="65" height="24" rx="12" fill="rgba(255,255,255,0.04)" stroke="var(--border-glass)"/>
            <text x="${n.x + n.w + 47}" y="${n.y + 28}" fill="var(--neon-amber)" text-anchor="middle" font-size="9" font-family="monospace">+40c hop</text>
          </g>
        `;
      });

      // Position Request Orb
      if (stage && stage.orb) {
        orb.classList.remove('hide');
        orb.setAttribute('cx', stage.orb.x);
        orb.setAttribute('cy', stage.orb.y);
        orb.className.baseVal = `request-orb ${stage.isKernel ? 'kernel-orb' : ''}`;
      }
    },

    renderMicrokernel(connLayer, nodeLayer, overlayLayer, orb, stage, engine) {
      const nodes = NodeLayouts.microkernel;
      const activeId = stage ? stage.activeNode : 'u_app';
      const isRecovered = engine.faultRecovered;

      // Connectors between User Servers and Microkernel Core
      const paths = [
        'M 175 120 L 175 220',          // App to Microkernel
        'M 450 120 L 450 220',          // FS to Microkernel
        'M 725 120 L 725 220',          // Driver to Microkernel
        'M 450 300 L 450 385'           // Microkernel to Hardware
      ];
      connLayer.innerHTML = paths.map(p => `<path d="${p}" class="connector-line active-path"/>`).join('');

      // Draw Nodes
      nodes.forEach(n => {
        const isActive = activeId === n.id;
        const isRecoveringServer = isRecovered && (n.id === engine.recoveringNode);
        const isReincarnationActive = isRecovered && n.id === 'u_reincarnation';

        let badgeTitle = n.title;
        if (isRecoveringServer) badgeTitle = '🛡️ RECOVERED & RETRIED';
        else if (isReincarnationActive) badgeTitle = '⚡ HEALED SERVER (+1500c)';

        nodeLayer.innerHTML += `
          <g class="node-group" data-id="${n.id}">
            <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" class="glass-node node-${n.type} ${isActive ? 'node-active' : ''} ${isReincarnationActive ? 'node-restarted' : ''} ${isRecoveringServer ? 'kernel-active' : ''} ${n.type === 'kernel' && isActive ? 'kernel-active' : ''}"/>
            <text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 - 4}" fill="var(--text-main)" text-anchor="middle" font-size="12" font-weight="700">${badgeTitle}</text>
            <text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 14}" fill="${n.type === 'user' ? 'var(--neon-cyan)' : 'var(--neon-purple)'}" text-anchor="middle" font-size="9" font-weight="600">${n.sub}</text>
          </g>
        `;
      });

      // Mini Message Queue Chip on Microkernel
      const queueDepth = (stage && stage.ipcEnvelope) ? '1 amber msg' : 'Idle';
      overlayLayer.innerHTML += `
        <g class="msg-queue-chip">
          <rect x="610" y="235" width="120" height="26" rx="13" fill="rgba(251, 191, 36, 0.15)" stroke="var(--neon-amber)"/>
          <text x="670" y="252" fill="var(--neon-amber)" text-anchor="middle" font-size="10" font-weight="700">✉ Queue: ${queueDepth}</text>
        </g>
      `;

      // Flying Amber Envelope for IPC stages
      if (stage && stage.ipcEnvelope) {
        overlayLayer.innerHTML += `
          <g class="flying-envelope" transform="translate(${stage.orb.x - 8}, ${stage.orb.y - 18})">
            <text fill="var(--neon-amber)" font-size="18">✉</text>
          </g>
        `;
      }

      // Position Request Orb
      if (stage && stage.orb) {
        orb.classList.remove('hide');
        orb.setAttribute('cx', stage.orb.x);
        orb.setAttribute('cy', stage.orb.y);
        orb.className.baseVal = `request-orb ${stage.isKernel ? 'kernel-orb' : ''} ${stage.ipcEnvelope ? 'amber-orb' : ''}`;
      }
    },

    renderCompare(connLayer, nodeLayer, overlayLayer, orb, stage, engine) {
      // Evaluate real computed numbers for all 3 architectures
      const mStages = engine.allStages.monolithic;
      const lStages = engine.allStages.layered;
      const uStages = engine.allStages.microkernel;

      let mIdx = Math.min(engine.stageIndex, mStages.length - 1);
      let lIdx = Math.min(engine.stageIndex, lStages.length - 1);
      const uIdx = Math.min(engine.stageIndex, uStages.length - 1);

      // Fault check per architecture: a Monolithic / Layered run halts at its first faulting stage
      const mFaultIdx = engine.currentFault ? mStages.findIndex(s => s.faultCandidate === engine.currentFault) : -1;
      const lFaultIdx = engine.currentFault ? lStages.findIndex(s => s.faultCandidate === engine.currentFault) : -1;
      const uFaultIdx = engine.currentFault ? uStages.findIndex(s => s.faultCandidate === engine.currentFault) : -1;
      const hasMonoFault = mFaultIdx !== -1 && mIdx >= mFaultIdx;
      const hasLayerFault = lFaultIdx !== -1 && lIdx >= lFaultIdx;
      if (hasMonoFault) mIdx = mFaultIdx;
      if (hasLayerFault) lIdx = lFaultIdx;
      const isMicroRecovered = uFaultIdx !== -1 && uIdx >= uFaultIdx;
      const monoNote = hasMonoFault ? '💥 KERNEL PANIC: system halted here.' : '2 mode switches, 0 context switches, 0 IPC.';
      const layerNote = hasLayerFault ? '💥 LAYER HALTED by assertion.' : 'Strict 6-tier hierarchy, 10 inter-layer function hops.';

      const mMetrics = computeCumulativeMetrics(mStages, mIdx);
      const lMetrics = computeCumulativeMetrics(lStages, lIdx);
      const uMetrics = computeCumulativeMetrics(uStages, uIdx, isMicroRecovered);

      const maxCycles = Math.max(mMetrics.cycles, lMetrics.cycles, uMetrics.cycles, 1);
      const mPercent = Math.max(10, Math.round((mMetrics.cycles / maxCycles) * 100));
      const lPercent = Math.max(15, Math.round((lMetrics.cycles / maxCycles) * 100));
      const uPercent = Math.max(20, Math.round((uMetrics.cycles / maxCycles) * 100));

      const monoSurvivability = hasMonoFault ? 0 : 100;
      const layerSurvivability = hasLayerFault ? 40 : 100;
      const microSurvivability = 100; // Always survives via reincarnation server

      nodeLayer.innerHTML = `
        <foreignObject x="0" y="0" width="900" height="480">
          <div xmlns="http://www.w3.org/1999/xhtml" class="compare-container">
            <!-- 3 Mini Stages -->
            <div class="compare-mini-stages">
              <div class="compare-mini-card">
                <div class="compare-mini-header">
                  <span class="compare-mini-title" style="color: var(--neon-cyan);">1. Monolithic (Linux)</span>
                  <span class="pill-badge">${mMetrics.cycles.toLocaleString()} cycles</span>
                </div>
                <div class="bar-track"><div class="bar-fill mono-fill" style="width: ${mPercent}%;"></div></div>
                <p style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.35rem;">
                  Stage ${mIdx + 1}/${mStages.length}: ${mStages[mIdx].title}. ${monoNote}
                </p>
                <span class="winner-badge winner-mono">⚡ Winner: Raw Throughput</span>
                <span style="font-size: 0.65rem; color: var(--text-muted); display: block; margin-top: 2px;">Why: Direct C function calls in Ring 0 avoid context switches and IPC copying.</span>
              </div>

              <div class="compare-mini-card">
                <div class="compare-mini-header">
                  <span class="compare-mini-title" style="color: var(--neon-purple);">2. Layered (THE OS)</span>
                  <span class="pill-badge">${lMetrics.cycles.toLocaleString()} cycles</span>
                </div>
                <div class="bar-track"><div class="bar-fill layer-fill" style="width: ${lPercent}%;"></div></div>
                <p style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.35rem;">
                  Stage ${lIdx + 1}/${lStages.length}: ${lStages[lIdx].title}. ${layerNote}
                </p>
                <span class="winner-badge winner-layer">📐 Winner: Clean Abstraction</span>
                <span style="font-size: 0.65rem; color: var(--text-muted); display: block; margin-top: 2px;">Why: Strict concentric tiers enable formal verification and eliminate circular dependencies.</span>
              </div>

              <div class="compare-mini-card">
                <div class="compare-mini-header">
                  <span class="compare-mini-title" style="color: var(--neon-green);">3. Microkernel (MINIX)</span>
                  <span class="pill-badge">${uMetrics.cycles.toLocaleString()} cycles</span>
                </div>
                <div class="bar-track"><div class="bar-fill micro-fill" style="width: ${uPercent}%;"></div></div>
                <p style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.35rem;">
                  Stage ${uIdx + 1}/${uStages.length}: ${uStages[uIdx].title}. 8 mode switches, 4 context switches, 4 IPC envelopes.
                </p>
                <span class="winner-badge winner-micro">🛡️ Winner: Reliability & Isolation</span>
                <span style="font-size: 0.65rem; color: var(--text-muted); display: block; margin-top: 2px;">Why: Subsystems run in user space; dead servers restart live without kernel downtime.</span>
              </div>
            </div>

            <!-- Dynamic Pure CSS Comparison Charts -->
            <div class="compare-charts-row">
              <div class="compare-chart-box">
                <h4>Total Execution Cycles (Lower is Faster)</h4>
                <div class="chart-bars-group">
                  <div class="bar-row">
                    <div class="bar-meta"><span>Monolithic</span><span>${mMetrics.cycles.toLocaleString()} c</span></div>
                    <div class="bar-track"><div class="bar-fill mono-fill" style="width: ${mPercent}%;"></div></div>
                  </div>
                  <div class="bar-row">
                    <div class="bar-meta"><span>Layered</span><span>${lMetrics.cycles.toLocaleString()} c</span></div>
                    <div class="bar-track"><div class="bar-fill layer-fill" style="width: ${lPercent}%;"></div></div>
                  </div>
                  <div class="bar-row">
                    <div class="bar-meta"><span>Microkernel</span><span>${uMetrics.cycles.toLocaleString()} c</span></div>
                    <div class="bar-track"><div class="bar-fill micro-fill" style="width: ${uPercent}%;"></div></div>
                  </div>
                </div>
              </div>

              <div class="compare-chart-box">
                <h4>Privilege & Context Switches (CR3)</h4>
                <div class="chart-bars-group">
                  <div class="bar-row">
                    <div class="bar-meta"><span>Monolithic</span><span>${mMetrics.modeSwitches} Ring / ${mMetrics.ctxSwitches} CR3</span></div>
                    <div class="bar-track"><div class="bar-fill mono-fill" style="width: 20%;"></div></div>
                  </div>
                  <div class="bar-row">
                    <div class="bar-meta"><span>Layered</span><span>${lMetrics.modeSwitches} Ring / ${lMetrics.ctxSwitches} CR3</span></div>
                    <div class="bar-track"><div class="bar-fill layer-fill" style="width: 20%;"></div></div>
                  </div>
                  <div class="bar-row">
                    <div class="bar-meta"><span>Microkernel</span><span>${uMetrics.modeSwitches} Ring / ${uMetrics.ctxSwitches} CR3</span></div>
                    <div class="bar-track"><div class="bar-fill micro-fill" style="width: 100%;"></div></div>
                  </div>
                </div>
              </div>

              <div class="compare-chart-box">
                <h4>Fault Survivability (${engine.currentFault ? engine.currentFault.replace('_', ' ').toUpperCase() : 'NO FAULT'})</h4>
                <div class="chart-bars-group">
                  <div class="bar-row">
                    <div class="bar-meta"><span>Monolithic</span><span>${monoSurvivability}% ${hasMonoFault ? '(PANIC)' : '(UP)'}</span></div>
                    <div class="bar-track"><div class="bar-fill mono-fill" style="width: ${monoSurvivability}%; background: ${hasMonoFault ? 'var(--neon-red)' : 'var(--neon-cyan)'};"></div></div>
                  </div>
                  <div class="bar-row">
                    <div class="bar-meta"><span>Layered</span><span>${layerSurvivability}% ${hasLayerFault ? '(HALT)' : '(UP)'}</span></div>
                    <div class="bar-track"><div class="bar-fill layer-fill" style="width: ${layerSurvivability}%; background: ${hasLayerFault ? 'var(--neon-amber)' : 'var(--neon-purple)'};"></div></div>
                  </div>
                  <div class="bar-row">
                    <div class="bar-meta"><span>Microkernel</span><span>${microSurvivability}% (HEALED)</span></div>
                    <div class="bar-track"><div class="bar-fill micro-fill" style="width: 100%; background: var(--neon-green);"></div></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Architectural Trade-Off Summary -->
            <div class="tradeoff-grid">
              <div class="tradeoff-card">
                <h5 style="color: var(--neon-cyan);">⚡ Monolithic Trade-Off</h5>
                <p><strong>Fastest but least isolated:</strong> Direct C calls in Ring 0 avoid context switches and IPC copying. However, a single bug in any driver or filesystem halts the entire CPU.</p>
              </div>
              <div class="tradeoff-card">
                <h5 style="color: var(--neon-purple);">📐 Layered Trade-Off</h5>
                <p><strong>Clean structure but extra overhead:</strong> Each layer can be formally verified. The downside is cumulative register spills and function stack overhead traversing every intermediate layer.</p>
              </div>
              <div class="tradeoff-card">
                <h5 style="color: var(--neon-green);">🛡️ Microkernel Trade-Off</h5>
                <p><strong>Most reliable/modular but most IPC overhead:</strong> Ring 3 daemons provide total fault containment. A driver crash self-heals in milliseconds, at the cost of multiple TLB flushes and context switches.</p>
              </div>
            </div>
          </div>
        </foreignObject>
      `;
      orb.classList.add('hide');
    }
  };

  /* ==========================================================================
     5. UI CONTROLLER & EVENT COORDINATOR
     ========================================================================== */
  const UIController = {
    init(engine) {
      this.engine = engine;
      this.cacheDOMElements();
      this.bindEvents();
      this.setupGuidedTour();
      this.render(engine);

      // Auto-open tour on first visit
      if (!localStorage.getItem('os_lab_tour_seen')) {
        setTimeout(() => this.startTour(), 350);
      }
    },

    cacheDOMElements() {
      // Topbar Tabs
      this.archTabs = document.querySelectorAll('.arch-tab');
      this.btnTheoryDrawer = document.getElementById('btn-theory-drawer');
      this.btnTour = document.getElementById('btn-tour');
      this.btnExportReport = document.getElementById('btn-export-report');
      this.btnThemeToggle = document.getElementById('btn-theme-toggle');

      // Left Panel
      this.syscallButtons = document.querySelectorAll('.syscall-btn');
      this.syscallCodePreview = document.getElementById('syscall-code-preview');
      this.btnFaultDriver = document.getElementById('btn-fault-driver');
      this.btnFaultFs = document.getElementById('btn-fault-fs');
      this.btnFaultClear = document.getElementById('btn-fault-clear');
      this.faultStatusPill = document.getElementById('fault-status-pill');
      this.speedSlider = document.getElementById('speed-slider');
      this.speedReadout = document.getElementById('speed-readout');

      // Center Stage
      this.stageSvg = document.getElementById('stage-svg');
      this.stageAlertBanner = document.getElementById('stage-alert-banner');
      this.alertIconBox = document.getElementById('alert-icon-box');
      this.alertTitle = document.getElementById('alert-title');
      this.alertDesc = document.getElementById('alert-desc');
      this.alertBadge = document.getElementById('alert-badge');

      // Right Explainer Panel
      this.stageNumberChip = document.getElementById('stage-number-chip');
      this.stageModeBadge = document.getElementById('stage-mode-badge');
      this.stageHeadline = document.getElementById('stage-headline');
      this.stagePlainEnglish = document.getElementById('stage-plain-english');
      this.privilegeSwitchPill = document.getElementById('privilege-switch-pill');
      this.privilegeSwitchText = document.getElementById('privilege-switch-text');
      this.stateDiffRows = document.getElementById('state-diff-rows');
      this.cntCycles = document.getElementById('cnt-cycles');
      this.cntModeSwitches = document.getElementById('cnt-mode-switches');
      this.cntCtxSwitches = document.getElementById('cnt-ctx-switches');
      this.cntIpc = document.getElementById('cnt-ipc');
      this.cntLayers = document.getElementById('cnt-layers');
      this.activeOpcodePill = document.getElementById('active-opcode-pill');
      this.microTerminal = document.getElementById('micro-terminal');

      // Hardware Registers & PCB State
      this.cpuRingBadge = document.getElementById('cpu-ring-badge');
      this.regCpl = document.getElementById('reg-cpl');
      this.regRax = document.getElementById('reg-rax');
      this.regRip = document.getElementById('reg-rip');
      this.regRsp = document.getElementById('reg-rsp');
      this.regCr3 = document.getElementById('reg-cr3');
      this.statusTlb = document.getElementById('status-tlb');
      this.pcbProcess = document.getElementById('pcb-process');
      this.pcbState = document.getElementById('pcb-state');

      // Bottom Timeline Bar
      this.btnStepBack = document.getElementById('btn-step-back');
      this.btnPlayPause = document.getElementById('btn-play-pause');
      this.btnStepFwd = document.getElementById('btn-step-fwd');
      this.btnReset = document.getElementById('btn-reset');
      this.timelineProgressFill = document.getElementById('timeline-progress-fill');
      this.timelineDotsContainer = document.getElementById('timeline-dots-container');
      this.timelineStageTitle = document.getElementById('timeline-stage-title');

      // Drawers & Modals
      this.theoryDrawer = document.getElementById('theory-drawer');
      this.btnCloseTheory = document.getElementById('btn-close-theory');
      this.tourBackdrop = document.getElementById('tour-backdrop');
      this.modalReport = document.getElementById('modal-report');
      this.btnCloseReport = document.getElementById('btn-close-report');
      this.printableReportContent = document.getElementById('printable-report-content');
      this.btnDownloadJson = document.getElementById('btn-download-json');
      this.btnPrintSummary = document.getElementById('btn-print-summary');
    },

    bindEvents() {
      // Architecture Segmented Control Tabs
      this.archTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          this.archTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const arch = tab.getAttribute('data-arch');
          this.engine.setArchitecture(arch);
        });
      });

      // Syscall Picker Buttons
      this.syscallButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          this.syscallButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const sc = btn.getAttribute('data-syscall');
          this.engine.setSyscall(sc);
        });
      });

      // Fault Injection Buttons
      this.btnFaultDriver.addEventListener('click', () => {
        this.btnFaultDriver.classList.add('active');
        this.btnFaultFs.classList.remove('active');
        this.engine.injectFault('driver_crash');
      });

      this.btnFaultFs.addEventListener('click', () => {
        this.btnFaultFs.classList.add('active');
        this.btnFaultDriver.classList.remove('active');
        this.engine.injectFault('fs_crash');
      });

      this.btnFaultClear.addEventListener('click', () => {
        this.btnFaultDriver.classList.remove('active');
        this.btnFaultFs.classList.remove('active');
        this.engine.clearFault();
      });

      // Playback Controls
      this.btnStepFwd.addEventListener('click', () => this.engine.stepForward());
      this.btnStepBack.addEventListener('click', () => this.engine.stepBackward());
      this.btnPlayPause.addEventListener('click', () => {
        if (this.engine.isPlaying) this.engine.pause();
        else this.engine.play();
      });
      this.btnReset.addEventListener('click', () => this.engine.reset());

      // Speed Slider
      this.speedSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.engine.playSpeed = val;
        this.speedReadout.textContent = `${(800 / val).toFixed(1)}x (${val}ms)`;
      });

      // Keyboard Accessibility
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.code === 'Space') {
          e.preventDefault();
          this.btnPlayPause.click();
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          this.btnStepFwd.click();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          this.btnStepBack.click();
        } else if (e.key === 'r' || e.key === 'R') {
          this.btnReset.click();
        } else if (e.key === '1') {
          document.getElementById('tab-mono').click();
        } else if (e.key === '2') {
          document.getElementById('tab-layer').click();
        } else if (e.key === '3') {
          document.getElementById('tab-micro').click();
        } else if (e.key === '4') {
          document.getElementById('tab-compare').click();
        }
      });

      // Theme Toggle
      this.btnThemeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
      });

      // Theory Drawer Toggle
      this.btnTheoryDrawer.addEventListener('click', () => {
        this.theoryDrawer.classList.toggle('hide');
      });
      this.btnCloseTheory.addEventListener('click', () => {
        this.theoryDrawer.classList.add('hide');
      });

      // Tour Modal Trigger
      this.btnTour.addEventListener('click', () => {
        this.startTour();
      });

      // Export Report Modal
      this.btnExportReport.addEventListener('click', () => {
        this.generatePrintableReport();
        this.modalReport.classList.remove('hide');
      });
      this.btnCloseReport.addEventListener('click', () => {
        this.modalReport.classList.add('hide');
      });
      this.btnDownloadJson.addEventListener('click', () => {
        this.downloadReportJson();
      });
      this.btnPrintSummary.addEventListener('click', () => {
        window.print();
      });
    },

    render(engine) {
      const stage = engine.getCurrentStage();
      const totalStages = engine.stages.length;

      // 1. Render Left Syscall Code Preview
      const sc = Syscalls[engine.currentSyscall];
      this.syscallCodePreview.innerHTML = `<code>${sc.signature}</code>`;

      // 2. Render Fault Status Pill & Alert Banner
      this.renderFaultState(engine, stage);

      // Compute cumulative metrics (single source of truth)
      const cumulative = engine.currentArch === 'compare'
        ? (stage && stage.counters ? stage.counters : { cycles: 0, modeSwitches: 0, ctxSwitches: 0, ipc: 0, layers: 1 })
        : computeCumulativeMetrics(engine.stages, engine.stageIndex, engine.faultRecovered);

      // 3. Render Right Explainer Card
      if (stage) {
        this.stageNumberChip.textContent = `STAGE ${stage.num} OF ${totalStages}`;
        this.stageHeadline.textContent = stage.title;
        this.stagePlainEnglish.textContent = stage.desc;

        // Mode badge
        this.stageModeBadge.className = `mode-badge ${stage.isKernel ? 'kernel-mode' : 'user-mode'}`;
        this.stageModeBadge.innerHTML = `<span class="dot"></span> ${stage.mode}`;

        // Privilege switch indicator
        if (stage.isSwitch) {
          this.privilegeSwitchPill.className = 'privilege-switch-pill switch-active';
          this.privilegeSwitchText.textContent = stage.switchText;
        } else {
          this.privilegeSwitchPill.className = 'privilege-switch-pill';
          this.privilegeSwitchText.textContent = stage.switchText;
        }

        // Before ➔ After Diff Rows
        if (stage.diff) {
          this.stateDiffRows.innerHTML = Object.entries(stage.diff).map(([k, v]) => `
            <div class="diff-row">
              <span class="diff-key">${k}:</span>
              <span class="diff-val">${v}</span>
            </div>
          `).join('');
        }

        // Running Counters (from single source of truth!)
        this.cntCycles.textContent = cumulative.cycles.toLocaleString();
        this.cntModeSwitches.textContent = cumulative.modeSwitches;
        this.cntCtxSwitches.textContent = cumulative.ctxSwitches;
        this.cntIpc.textContent = cumulative.ipc;
        this.cntLayers.textContent = cumulative.layers;

        // Hardware Registers & PCB State
        if (stage.hardware) {
          const hw = stage.hardware;
          if (this.cpuRingBadge) this.cpuRingBadge.textContent = `CPL: ${hw.cpl} (${hw.cpl === 0 ? 'Supervisor' : 'User'})`;
          if (this.regCpl) this.regCpl.textContent = `Ring ${hw.cpl}`;
          if (this.regRax) this.regRax.textContent = hw.rax;
          if (this.regRip) this.regRip.textContent = hw.rip;
          if (this.regRsp) this.regRsp.textContent = hw.rsp;
          if (this.regCr3) this.regCr3.textContent = hw.cr3;

          if (this.statusTlb) {
            this.statusTlb.textContent = hw.tlb;
            this.statusTlb.className = `reg-val mono ${hw.tlb === 'HIT' ? 'tlb-hit' : (hw.tlb === 'MISS' ? 'tlb-miss' : 'tlb-flush')}`;
          }

          if (this.pcbProcess && hw.pcb) this.pcbProcess.textContent = `${hw.pcb.name} (PID ${hw.pcb.pid})`;
          if (this.pcbState && hw.pcb) {
            this.pcbState.textContent = hw.pcb.state;
            this.pcbState.className = `pcb-state-badge state-${hw.pcb.state.toLowerCase()}`;
          }
        }

        // Micro-Op Stream (Scrolling Terminal with All Previous Stages)
        if (stage.microOp) {
          this.activeOpcodePill.textContent = stage.microOp.split(';')[0].trim();

          let termHtml = '';
          const currentIdx = engine.stageIndex;
          for (let i = 0; i <= currentIdx; i++) {
            const s = engine.stages[i];
            const isLatest = (i === currentIdx);
            termHtml += `
              <div class="terminal-line ${isLatest ? 'active' : ''}">
                <span style="color: var(--neon-cyan);">[T+${(i + 1) * 40}ns]</span> ${s.microOp}
              </div>
            `;
          }
          this.microTerminal.innerHTML = termHtml;
          this.microTerminal.scrollTop = this.microTerminal.scrollHeight;
        }
      }

      // 4. Render Bottom Stepper
      this.btnStepBack.disabled = engine.historyStack.length === 0;
      this.timelineStageTitle.textContent = stage ? `Stage ${stage.num}: ${stage.title}` : '';

      // Progress Line & Dots
      const progressPercent = totalStages > 1 ? (engine.stageIndex / (totalStages - 1)) * 100 : 0;
      this.timelineProgressFill.style.width = `${progressPercent}%`;

      // Timeline dots rendered as accessible BUTTONS with aria-label
      this.timelineDotsContainer.innerHTML = engine.stages.map((s, idx) => {
        let cls = 'timeline-dot';
        if (idx === engine.stageIndex) cls += ' active';
        else if (idx < engine.stageIndex) cls += ' completed';
        return `<button type="button" class="${cls}" data-idx="${idx}" aria-label="Jump to Stage ${s.num}: ${s.title}" title="Stage ${s.num}: ${s.title}"></button>`;
      }).join('');

      // Add click listeners to timeline dots
      this.timelineDotsContainer.querySelectorAll('.timeline-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          const idx = parseInt(dot.getAttribute('data-idx'), 10);
          engine.jumpToStage(idx);
        });
      });

      // 5. Render Central Animated Stage
      AbstractStageRenderer.render(this.stageSvg, engine);
    },

    renderFaultState(engine, stage) {
      if (engine.faultTriggered) {
        if (engine.currentArch === 'monolithic') {
          this.faultStatusPill.className = 'fault-status-pill panic';
          this.faultStatusPill.textContent = 'Kernel Panic';

          this.stageAlertBanner.className = 'stage-alert-banner';
          this.alertIconBox.textContent = '☠️';
          this.alertTitle.textContent = 'Kernel Panic: System Halted';
          const failedSub = engine.currentFault === 'fs_crash' ? 'File System (Ext4)' : 'Device Driver';
          this.alertDesc.textContent = `Uncaught ${failedSub} exception in Ring 0 supervisor space. Entire OS halted.`;
          this.alertBadge.textContent = 'SYSTEM DOWN (0% UPTIME)';
          this.stageAlertBanner.classList.remove('hide');
        } else if (engine.currentArch === 'layered') {
          this.faultStatusPill.className = 'fault-status-pill panic';
          this.faultStatusPill.textContent = 'Layer Blocked';

          this.stageAlertBanner.className = 'stage-alert-banner';
          this.alertIconBox.textContent = '⚠️';
          this.alertTitle.textContent = 'Layer Assertion Failed';
          const failedLayer = engine.currentFault === 'fs_crash' ? 'Layer 3 (File System)' : 'Layer 1 (Device Driver)';
          this.alertDesc.textContent = `${failedLayer} assertion tripped. Cascading pipeline halted; hardware protected.`;
          this.alertBadge.textContent = 'CASCADE HALTED';
          this.stageAlertBanner.classList.remove('hide');
        }
      } else if (engine.faultRecovered && engine.currentArch === 'microkernel') {
        // Microkernel Self-Healing Display
        this.faultStatusPill.className = 'fault-status-pill recovering';
        this.faultStatusPill.textContent = 'Recovered (+1500c)';

        this.stageAlertBanner.className = 'stage-alert-banner recovery';
        this.alertIconBox.textContent = '🛡️';
        this.alertTitle.textContent = 'Fault Isolated & Recovered';
        const serverName = engine.currentFault === 'fs_crash' ? 'File Server (PID 10)' : 'Driver Server (PID 12)';
        this.alertDesc.textContent = `${serverName} crashed in isolated Ring 3. Reincarnation Server (PID 2) restarted it (+1,500 cycles). Request retried — 100% UPTIME!`;
        this.alertBadge.textContent = '100% UPTIME MAINTAINED';
        this.stageAlertBanner.classList.remove('hide');
      } else {
        this.faultStatusPill.className = 'fault-status-pill normal';
        this.faultStatusPill.textContent = 'Normal';
        this.stageAlertBanner.classList.add('hide');
      }
    },

    setupGuidedTour() {
      const tourSteps = [
        {
          icon: '🧭',
          title: 'Welcome to OS Structure Lab',
          desc: 'This simulator models how ONE system call (e.g. read, write, open, fork, send_message) journeys through three distinct OS architectures.'
        },
        {
          icon: '🎛️',
          title: 'System Calls & Architecture Modes',
          desc: 'Select a syscall on the left, then toggle between Monolithic (Linux), Layered (THE OS), Microkernel (MINIX/QNX), or Compare All.'
        },
        {
          icon: '🔮',
          title: 'The Animated Stage & Live Hardware Registers',
          desc: 'Follow the glowing request orb as it travels node to node. Inspect live CPU registers (CPL, RAX, RIP, RSP, CR3), TLB hits/flushes, and PCB states.'
        },
        {
          icon: '💥',
          title: 'Fault Injection & Self-Healing',
          desc: 'Inject "Crash Driver" or "Crash File System" to contrast a Monolithic kernel panic vs. a Microkernel server self-healing live with 100% uptime!'
        }
      ];

      let curStep = 0;
      const counterEl = document.getElementById('tour-step-counter');
      const iconEl = document.getElementById('tour-icon');
      const titleEl = document.getElementById('tour-title');
      const descEl = document.getElementById('tour-desc');
      const dotsEl = document.getElementById('tour-dots');
      const btnPrev = document.getElementById('btn-tour-prev');
      const btnNext = document.getElementById('btn-tour-next');
      const btnClose = document.getElementById('btn-close-tour');

      const renderTourStep = () => {
        const s = tourSteps[curStep];
        counterEl.textContent = `STEP ${curStep + 1} OF ${tourSteps.length}`;
        iconEl.textContent = s.icon;
        titleEl.textContent = s.title;
        descEl.textContent = s.desc;

        btnPrev.disabled = curStep === 0;
        btnNext.textContent = curStep === tourSteps.length - 1 ? 'Start Simulating' : 'Next';

        dotsEl.querySelectorAll('.tour-dot').forEach((d, i) => {
          if (i === curStep) d.classList.add('active');
          else d.classList.remove('active');
        });
      };

      btnPrev.addEventListener('click', () => {
        if (curStep > 0) {
          curStep--;
          renderTourStep();
        }
      });

      btnNext.addEventListener('click', () => {
        if (curStep < tourSteps.length - 1) {
          curStep++;
          renderTourStep();
        } else {
          this.tourBackdrop.classList.add('hide');
          localStorage.setItem('os_lab_tour_seen', 'true');
        }
      });

      btnClose.addEventListener('click', () => {
        this.tourBackdrop.classList.add('hide');
        localStorage.setItem('os_lab_tour_seen', 'true');
      });

      this.startTour = () => {
        curStep = 0;
        renderTourStep();
        this.tourBackdrop.classList.remove('hide');
      };
    },

    generatePrintableReport() {
      const eng = this.engine;
      const sc = Syscalls[eng.currentSyscall];

      // Calculate real results across all 3 architectures
      const mStages = eng.allStages.monolithic;
      const lStages = eng.allStages.layered;
      const uStages = eng.allStages.microkernel;

      const hasMonoFault = eng.currentFault && mStages.some(s => s.faultCandidate === eng.currentFault);
      const hasLayerFault = eng.currentFault && lStages.some(s => s.faultCandidate === eng.currentFault);
      const isMicroRecovered = eng.faultRecovered || (eng.currentFault !== null);

      const mMetrics = computeCumulativeMetrics(mStages, mStages.length - 1);
      const lMetrics = computeCumulativeMetrics(lStages, lStages.length - 1);
      const uMetrics = computeCumulativeMetrics(uStages, uStages.length - 1, isMicroRecovered);

      this.printableReportContent.innerHTML = `
        <div style="font-family: sans-serif; color: #000; line-height: 1.5;">
          <h2 style="margin-bottom: 4px;">OS Structure Lab: Architecture Benchmark Report</h2>
          <p style="color: #666; margin-bottom: 16px;">Comparative Syscall Flow, Privilege Invariants, and Fault Isolation Analysis</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
            <tr style="background: #f4f4f4;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Evaluated Syscall</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Architecture</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Active Fault</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Execution Status</th>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${sc.signature}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-transform: uppercase;"><strong>${eng.currentArch}</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${eng.currentFault ? eng.currentFault.replace('_', ' ').toUpperCase() : 'None'}</td>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${eng.faultTriggered ? 'HALTED / PANIC' : (eng.faultRecovered ? 'RECOVERED (+1500c)' : 'NORMAL COMPLETION')}</td>
            </tr>
          </table>

          <h3 style="margin-bottom: 8px;">Real Architectural Benchmark Metrics</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
            <tr style="background: #f4f4f4;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Metric</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Monolithic</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Layered</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Microkernel</th>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Cycles</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;"><strong>${mMetrics.cycles.toLocaleString()} c</strong> (Fastest)</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${lMetrics.cycles.toLocaleString()} c</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${uMetrics.cycles.toLocaleString()} c</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Privilege Mode Switches</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${mMetrics.modeSwitches} (Ring 3 ➔ 0 ➔ 3)</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${lMetrics.modeSwitches}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${uMetrics.modeSwitches}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Context Switches (CR3)</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${mMetrics.ctxSwitches}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${lMetrics.ctxSwitches}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${uMetrics.ctxSwitches}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>IPC Envelopes</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${mMetrics.ipc}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${lMetrics.ipc}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${uMetrics.ipc}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Fault Survivability</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: ${hasMonoFault ? '#c00' : '#080'}; font-weight: bold;">${hasMonoFault ? '0% (Kernel Panic)' : '100% (Normal)'}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: ${hasLayerFault ? '#d97706' : '#080'};">${hasLayerFault ? '40% (Halted)' : '100% (Normal)'}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #080; font-weight: bold;">100% (Self-Healing)</td>
            </tr>
          </table>

          <h3 style="margin-bottom: 8px;">Key Architectural Takeaways</h3>
          <p style="font-size: 0.85rem; color: #333; margin-bottom: 6px;">
            <strong>Monolithic:</strong> Fastest execution (${mMetrics.cycles.toLocaleString()}c) via direct C calls in Ring 0, but total absence of internal fault boundaries causes whole-system crashes on driver faults.
          </p>
          <p style="font-size: 0.85rem; color: #333; margin-bottom: 6px;">
            <strong>Layered:</strong> Clean formal hierarchy with strict encapsulation; intermediate stack traversal adds +40 cycles per hop (${lMetrics.cycles.toLocaleString()}c total).
          </p>
          <p style="font-size: 0.85rem; color: #333;">
            <strong>Microkernel:</strong> Unrivaled fault isolation (${uMetrics.cycles.toLocaleString()}c). Server crash is transparently self-healed by the Reincarnation Server (+1,500c penalty) maintaining 100% OS availability.
          </p>
        </div>
      `;
    },

    downloadReportJson() {
      const eng = this.engine;
      const stage = eng.getCurrentStage();
      const sc = Syscalls[eng.currentSyscall];

      const mStages = eng.allStages.monolithic;
      const lStages = eng.allStages.layered;
      const uStages = eng.allStages.microkernel;

      const hasMonoFault = eng.currentFault && mStages.some(s => s.faultCandidate === eng.currentFault);
      const hasLayerFault = eng.currentFault && lStages.some(s => s.faultCandidate === eng.currentFault);
      const isMicroRecovered = eng.faultRecovered || (eng.currentFault !== null);

      const mMetrics = computeCumulativeMetrics(mStages, mStages.length - 1);
      const lMetrics = computeCumulativeMetrics(lStages, lStages.length - 1);
      const uMetrics = computeCumulativeMetrics(uStages, uStages.length - 1, isMicroRecovered);

      const report = {
        title: 'OS Structure Lab - Syscall Simulation Report',
        timestamp: new Date().toISOString(),
        costModel: COST_MODEL,
        syscall: {
          key: eng.currentSyscall,
          name: sc.name,
          signature: sc.signature,
          tag: sc.tag
        },
        currentRun: {
          architecture: eng.currentArch,
          activeFault: eng.currentFault,
          stageIndex: eng.stageIndex,
          totalStages: eng.stages.length,
          faultTriggered: eng.faultTriggered,
          faultRecovered: eng.faultRecovered,
          activeHardware: stage ? stage.hardware : null
        },
        benchmarkComparison: {
          monolithic: {
            cycles: mMetrics.cycles,
            modeSwitches: mMetrics.modeSwitches,
            contextSwitches: mMetrics.ctxSwitches,
            ipcMessages: mMetrics.ipc,
            survivability: hasMonoFault ? '0% (Kernel Panic)' : '100% (Normal)'
          },
          layered: {
            cycles: lMetrics.cycles,
            modeSwitches: lMetrics.modeSwitches,
            contextSwitches: lMetrics.ctxSwitches,
            ipcMessages: lMetrics.ipc,
            survivability: hasLayerFault ? '40% (Layer Halted)' : '100% (Normal)'
          },
          microkernel: {
            cycles: uMetrics.cycles,
            modeSwitches: uMetrics.modeSwitches,
            contextSwitches: uMetrics.ctxSwitches,
            ipcMessages: uMetrics.ipc,
            survivability: '100% (Self-Healing via Reincarnation Server)'
          }
        }
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `os-structure-${eng.currentArch}-${eng.currentSyscall}-report.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  /* ==========================================================================
     6. INITIALIZATION BOOTSTRAP
     ========================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    const engine = new AbstractSimulationEngine();
    UIController.init(engine);
  });

})();
