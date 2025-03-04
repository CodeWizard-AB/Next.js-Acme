"use server";

import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const FormSchema = z.object({
	id: z.string(),
	customerId: z.string({
		invalid_type_error: "Please select a customer.",
	}),
	amount: z.coerce
		.number()
		.gt(0, { message: "Please enter an amount greater than $0." }),
	status: z.enum(["pending", "paid"], {
		invalid_type_error: "Please select an invoice status.",
	}),
	date: z.string(),
});

export type State = {
	errors?: {
		customerId?: string[];
		amount?: string[];
		status?: string[];
	};
	message?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ date: true });

export async function createInvoice(prevState: State, formData: FormData) {
	const { success, error, data } = CreateInvoice.safeParse({
		customerId: formData.get("customerId"),
		amount: Number(formData.get("amount")),
		status: formData.get("status"),
	});

	if (!success) {
		return {
			errors: error.flatten().fieldErrors,
			message: "Missing Fields. Failed to Create Invoice.",
		};
	}

	const { customerId, amount, status } = data;
	const amountInCents = 100 * amount;
	const date = new Date().toISOString().split("T")[0];

	try {
		await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
	} catch (error) {
		return {
			message: "Database Error: Failed to Create Invoice.",
		};
	}

	revalidatePath("/dashboard/invoices");
	redirect("/dashboard/invoices");
}

export async function updateInvoice(formData: FormData) {
	const { customerId, amount, status, id } = UpdateInvoice.parse({
		customerId: formData.get("customerId"),
		amount: Number(formData.get("amount")),
		status: formData.get("status"),
		id: formData.get("id"),
	});
	const amountInCents = amount * 100;

	try {
		await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
	} catch (error) {
		return { message: "Database Error: Failed to Update Invoice." };
	}

	revalidatePath("/dashboard/invoices");
	redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
	throw new Error("Failed to Delete Invoice");
	try {
		await sql`DELETE FROM invoices WHERE id = ${id}`;
		revalidatePath("/dashboard/invoices");
		return { message: "Deleted Invoice." };
	} catch (error) {
		return { message: "Database Error: Failed to Delete Invoice." };
	}
}
