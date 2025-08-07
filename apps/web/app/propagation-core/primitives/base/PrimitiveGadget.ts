import { ContactGroup } from "../../models/ContactGroup";
import type { ContactId, GroupId } from "../../types";
import type { Contact } from "../../models/Contact";

export abstract class PrimitiveGadget extends ContactGroup {
  readonly isPrimitive = true;

  constructor(id: GroupId, name: string, parent?: ContactGroup) {
    super(id, name, parent);
  }

  // Override deliverContent to intercept propagation and trigger maybeRun
  override deliverContent(
    contactId: ContactId,
    content: any,
    sourceId: ContactId,
  ): void {
    // Only intercept for input boundary contacts
    const contact = this.contacts.get(contactId);
    if (
      !contact ||
      !contact.isBoundary ||
      contact.boundaryDirection !== "input"
    ) {
      // Not an input, use normal delivery
      super.deliverContent(contactId, content, sourceId);
      return;
    }

    // Store the input value (including undefined when cleared)
    contact["_content"] = content;

    // Try to run the primitive computation
    this.maybeRun();
  }

  // Core primitive gadget logic - check activation and maybe run body
  protected maybeRun(): void {
    // Gather all boundary contact values
    const inputs = this.getAllBoundaryValues();

    // Check if we should run
    if (this.activation(inputs)) {
      // Run the body to compute outputs
      const outputs = this.body(inputs);

      // Propagate the computed outputs
      this.propagateOutputs(outputs);
    } else {
      // Activation returned false - not all required inputs are present
      // Clear outputs to indicate the primitive can't compute
      this.clearAllOutputs();
    }
  }

  // Get all boundary contact values (both inputs and outputs)
  protected getAllBoundaryValues(): Map<ContactId, [Contact, any]> {
    const values = new Map<ContactId, [Contact, any]>();

    for (const contactId of this.boundaryContacts) {
      const contact = this.contacts.get(contactId);
      if (contact && contact.isBoundary) {
        values.set(contactId, [contact, contact.content]);
      }
    }

    return values;
  }

  // Propagate computed outputs
  protected propagateOutputs(outputs: Map<ContactId, any>): void {
    for (const [contactId, value] of outputs) {
      const contact = this.contacts.get(contactId);
      if (
        contact &&
        contact.isBoundary &&
        contact.boundaryDirection === "output"
      ) {
        const oldContent = contact.content;
        contact["_content"] = value;

        // Propagate if changed
        if (value !== oldContent) {
          // Propagate to parent group connections
          if (this.parent) {
            const parentConnections =
              this.parent.getOutgoingConnections(contactId);
            for (const { targetId } of parentConnections) {
              this.parent.deliverContent(targetId, value, contactId);
            }
          }
        }
      }
    }
  }

  // Clear all output contacts
  protected clearAllOutputs(): void {
    for (const contactId of this.boundaryContacts) {
      const contact = this.contacts.get(contactId);
      if (
        contact &&
        contact.isBoundary &&
        contact.boundaryDirection === "output"
      ) {
        if (contact.content !== undefined) {
          contact["_content"] = undefined;

          // Propagate the clearing
          if (this.parent) {
            const parentConnections =
              this.parent.getOutgoingConnections(contactId);
            for (const { targetId } of parentConnections) {
              this.parent.deliverContent(targetId, undefined, contactId);
            }
          }
        }
      }
    }
  }

  // Abstract methods that primitive gadgets must implement

  // Activation function - determines if the body should run
  // Receives all boundary contact values (inputs and outputs)
  protected abstract activation(
    boundaryValues: Map<ContactId, [Contact, any]>,
  ): boolean;

  // Body function - computes outputs based on current boundary values
  // Only called when activation returns true
  // Returns a map of output contact IDs to their computed values
  protected abstract body(
    boundaryValues: Map<ContactId, [Contact, any]>,
  ): Map<ContactId, any>;
}
