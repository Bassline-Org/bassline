'use client'

import type { ActionFunctionArgs } from "react-router";
import { data as json } from "react-router";
import { getNetworkClient } from "~/network/client";
import { importBassline, deserializeBassline } from "~/propagation-core-v2/bassline";
import type { ImportOptions } from "~/propagation-core-v2/bassline";

export async function clientAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const basslineJson = formData.get("bassline") as string;
  const parentGroupId = formData.get("parentGroupId") as string || "root";
  const applySeeds = formData.get("applySeeds") !== "false";
  
  if (!basslineJson) {
    return json(
      { success: false, error: "No bassline data provided" },
      { status: 400 }
    );
  }
  
  try {
    const client = getNetworkClient();
    const bassline = deserializeBassline(basslineJson);
    
    // Validate bassline
    if (!bassline.name) {
      return json(
        { success: false, error: "Invalid bassline: missing name" },
        { status: 400 }
      );
    }
    
    // Import options
    const options: ImportOptions = {
      parentGroupId,
      applySeeds,
      validate: true
    };
    
    const result = await importBassline(bassline, client, options);
    
    // Build summary
    const summary = {
      groups: result.groups.length,
      contacts: result.contacts.length,
      wires: result.wires.length,
      warnings: result.warnings
    };
    
    return json({
      success: true,
      name: bassline.name,
      summary,
      result
    });
  } catch (error) {
    console.error("Import failed:", error);
    return json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Import failed" 
      },
      { status: 500 }
    );
  }
}