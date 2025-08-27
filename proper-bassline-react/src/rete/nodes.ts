import { OrdinalCell } from "proper-bassline/src/cells/basic";
import { Cell, TypedCell } from "proper-bassline/src/cell"
import { FunctionGadget, type FunctionGadgetArgs } from "proper-bassline/src/function"
import { LatticeValue } from "proper-bassline/src/lattice-types"
import type { Connection as GadgetConnection } from "proper-bassline/src/gadget-base"
import type { Gadget } from "proper-bassline/src/gadget"
import { ClassicPreset, type BaseSchemes, type GetSchemes } from "rete"
import { CustomControl } from "./components/CustomControl"
import { InputControl } from "./components/InputControl"

const cellSocket = new ClassicPreset.Socket("cellSocket");
const functionSocket = new ClassicPreset.Socket("functionSocket");

export abstract class GadgetNode<T extends Gadget = Gadget> extends ClassicPreset.Node {
    gadget: T
    constructor(gadget: T) {
        super(gadget.id)
        this.gadget = gadget
    }
}

export class CellNode extends GadgetNode<Cell> {
  currentValue: LatticeValue | null = null
  gadgetId: string
  
  constructor(cell: Cell) {
    super(cell)
    this.gadgetId = cell.id
    
    // Add output socket
    this.addOutput('output', new ClassicPreset.Output(cellSocket, 'Output', true))
    // Add input socket (cells can have multiple connections)
    this.addInput('input', new ClassicPreset.Input(cellSocket, 'Input', true))
    
    // If the cell is an OrdinalCell, add an input control
    if (this.gadget instanceof OrdinalCell) {
        console.log('[CellNode] Adding InputControl for OrdinalCell:', this.gadget.id)
        const control = new CustomControl(InputControl, {
            cell: this.gadget,
            onValueChange: () => {
                // Trigger update when value changes
                this.currentValue = this.gadget.getOutput()
                console.log('[CellNode] Value changed:', this.currentValue)
            }
        })
        this.addControl('input', control)
        console.log('[CellNode] Control added:', control)
    }
    
    // Store current value
    this.currentValue = this.gadget.getOutput()
  }
}

export class TypedCellNode<T extends LatticeValue> extends CellNode {
    constructor(cell: TypedCell<T>) {
        super(cell)
    }
}

export class FunctionNode<T extends FunctionGadgetArgs = FunctionGadgetArgs> extends GadgetNode<FunctionGadget<T>> {
    gadgetId: string
    
    constructor(fn: FunctionGadget<T>) {
        super(fn)
        this.gadgetId = fn.id

        for(const [input, _] of fn.inputs) {
            this.addInput(input, new ClassicPreset.Input(functionSocket, input, false))
        }
        // Functions use 'output' socket like cells for consistency
        this.addOutput('output', new ClassicPreset.Output(functionSocket, 'Output', true))
    }
}

// Legacy CellControl - kept for compatibility
export class CellControl extends ClassicPreset.Control {
    cell: Cell
    constructor(cell: Cell) {
        super()
        this.cell = cell
    }
}

export type Node = CellNode | FunctionNode

export type Schemes = GetSchemes<GadgetNode, ClassicPreset.Connection<GadgetNode, GadgetNode>>
export type BasslineSchemes = Schemes & {
    Node: Node
    Connection: ClassicPreset.Connection<GadgetNode, GadgetNode> & {
        source: WeakRef<any>
        outputName: string
    }
}
  