import type { Meta, StoryObj } from '@storybook/react';
import { useGadget, GadgetContext, Tap } from 'port-graphs-react';
import { lastCell, binary, unary, ternary, withTaps, tapValue } from 'port-graphs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

// Shopping cart example with computed values
// All "derived" state is just function gadgets!

// Item gadgets (cells for state)
const itemsGadget = withTaps(lastCell([]));
const taxRateGadget = withTaps(lastCell(0.08)); // 8% tax
const discountGadget = withTaps(lastCell(0)); // Discount percentage

// Function gadgets for computed values
// These ARE our "derived state" - no special helpers needed!
const subtotalGadget = withTaps(unary(
  (items: Array<{ price: number; quantity: number }>) =>
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
)({ value: [] }));

const discountAmountGadget = withTaps(binary(
  (subtotal: number, discountPercent: number) =>
    subtotal * (discountPercent / 100)
)({ a: 0, b: 0 }));

const taxAmountGadget = withTaps(binary(
  (subtotal: number, taxRate: number) =>
    subtotal * taxRate
)({ a: 0, b: 0 }));

// Total combines multiple computed values
// This is a 3-input function gadget
const totalGadget = withTaps(ternary(
  (subtotal: number, tax: number, discount: number) =>
    subtotal + tax - discount
)({ a: 0, b: 0, c: 0 }));

// Shopping cart component
function ShoppingCart() {
  const [items, setItems] = useGadget(itemsGadget);
  const [taxRate, setTaxRate] = useGadget(taxRateGadget);
  const [discount, setDiscount] = useGadget(discountGadget);

  const [subtotalState] = useGadget(subtotalGadget);
  const [discountAmountState] = useGadget(discountAmountGadget);
  const [taxAmountState] = useGadget(taxAmountGadget);
  const [totalState] = useGadget(totalGadget);

  // Extract result values from function gadget states
  const subtotal = (subtotalState as any)?.result ?? 0;
  const discountAmount = (discountAmountState as any)?.result ?? 0;
  const taxAmount = (taxAmountState as any)?.result ?? 0;
  const total = (totalState as any)?.result ?? 0;

  const addItem = () => {
    const newItem = {
      name: `Item ${items.length + 1}`,
      price: Math.floor(Math.random() * 50) + 10,
      quantity: 1
    };
    setItems([...items, newItem]);
  };

  const updateQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = quantity;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_: any, i: number) => i !== index));
  };

  return (
    <>
      {/* Wire up the function gadgets - this is the "reactive" part */}
      <GadgetContext gadget={itemsGadget}>
        <Tap handler={(effect) => {
          if (effect?.changed !== undefined) {
            subtotalGadget.receive({ value: effect.changed });
          }
        }} />
      </GadgetContext>

      <GadgetContext gadget={subtotalGadget}>
        <Tap handler={tapValue(discountAmountGadget, 'a')} />
        <Tap handler={tapValue(taxAmountGadget, 'a')} />
        <Tap handler={tapValue(totalGadget, 'a')} />
      </GadgetContext>

      <GadgetContext gadget={discountGadget}>
        <Tap handler={tapValue(discountAmountGadget, 'b')} />
      </GadgetContext>

      <GadgetContext gadget={taxRateGadget}>
        <Tap handler={tapValue(taxAmountGadget, 'b')} />
      </GadgetContext>

      <GadgetContext gadget={discountAmountGadget}>
        <Tap handler={tapValue(totalGadget, 'c')} />
      </GadgetContext>

      <GadgetContext gadget={taxAmountGadget}>
        <Tap handler={tapValue(totalGadget, 'b')} />
      </GadgetContext>

      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Shopping Cart with Computed Values</CardTitle>
            <CardDescription>
              All computed values are just function gadgets - no special "derived" helpers needed!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Button onClick={addItem} variant="default">
                Add Item
              </Button>
            </div>

            {/* Items list */}
            <div className="space-y-2">
              {items.map((item: any, i: number) => (
                <Card key={i}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      <Badge variant="secondary">${item.price}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e: any) => updateQuantity(i, Number(e.target.value))}
                        className="w-20"
                      />
                      <Button onClick={() => removeItem(i)} variant="outline" size="sm">
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tax-rate">
                  Tax Rate: {(taxRate * 100).toFixed(0)}%
                </Label>
                <Slider
                  id="tax-rate"
                  min={0}
                  max={20}
                  step={1}
                  value={[taxRate * 100]}
                  onValueChange={([value]: any) => setTaxRate(value / 100)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount">
                  Discount: {discount}%
                </Label>
                <Slider
                  id="discount"
                  min={0}
                  max={50}
                  step={5}
                  value={[discount]}
                  onValueChange={([value]: any) => setDiscount(value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* Computed values display */}
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span className="font-mono">${taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span className="font-mono text-green-600">-${discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="font-mono">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

const meta = {
  title: 'Patterns/Computed Values',
  component: ShoppingCart,
  parameters: {
    docs: {
      description: {
        component: `
# Computed Values Pattern

Function gadgets ARE our derived/computed state. No special helpers needed!

## Key Insights

1. **Functions = Derived State** - Any function gadget computes from its inputs
2. **Automatic Recomputation** - Functions recompute when inputs change
3. **Lazy Evaluation** - Only computes when all inputs are present
4. **Composable** - Wire functions to other functions for complex computations

## Examples

\`\`\`typescript
// Simple selector (unary function)
const getName = unary(user => user.name);

// Computed from multiple sources (binary function)
const total = binary((price, quantity) => price * quantity);

// Complex computations
const summary = ternary((items, tax, discount) => {
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  return subtotal * (1 + tax) * (1 - discount);
});
\`\`\`

## Wiring Pattern

Wire cells to functions, functions to other functions:

\`\`\`jsx
<GadgetContext gadget={priceCell}>
  <Tap handler={tapValue(totalFunction, 'a')} />
</GadgetContext>

<GadgetContext gadget={quantityCell}>
  <Tap handler={tapValue(totalFunction, 'b')} />
</GadgetContext>
\`\`\`
        `
      }
    }
  }
} satisfies Meta<typeof ShoppingCart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ShoppingCart />
};