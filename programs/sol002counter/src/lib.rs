use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

declare_id!("E4MWtGRbfA6wUdYhZRfuN8ffX4dJ3cBrFhizY1muNmDi");

const FEE_LAMPORTS: u64 = 10_000_000; // 0.01 SOL

#[program]
pub mod counter_program {
    use super::*;

    // NEW: accept initial_lamports to fund the account in the same tx
    pub fn initialize(ctx: Context<Initialize>, start_value: i64, initial_lamports: u64) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = start_value;
        counter.owner = ctx.accounts.user.key();

        // Optionally skip if 0
        if initial_lamports > 0 {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.counter.to_account_info(),
                },
            );
            system_program::transfer(cpi_ctx, initial_lamports)?;
        }

        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        // cobra 0.01 SOL do caller e envia para a conta de dados
        pay_interaction_fee(&ctx, FEE_LAMPORTS)?;
        let counter = &mut ctx.accounts.counter;
        counter.count += 1;
        Ok(())
    }

    pub fn decrement(ctx: Context<Update>) -> Result<()> {
        pay_interaction_fee(&ctx, FEE_LAMPORTS)?;
        let counter = &mut ctx.accounts.counter;
        counter.count -= 1;
        Ok(())
    }

    pub fn finalize(ctx: Context<Finalize>) -> Result<()> {
        let counter = &ctx.accounts.counter;

        // regra de negócio (exemplo do seu código)
        require!(counter.count >= 3, CustomError::CountNotHighEnough);

        // apenas o owner pode finalizar
        require_keys_eq!(ctx.accounts.owner.key(), counter.owner, CustomError::NotOwner);

        // NÃO precisa transferir manualmente: o atributo `close = owner`
        // na conta `counter` já envia todos os lamports remanescentes para o owner.
        Ok(())
    }
}

// transfere a taxa de interação do usuário para a conta de dados
fn pay_interaction_fee(ctx: &Context<Update>, lamports: u64) -> Result<()> {
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.counter.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, lamports)?;
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        // 8 (discriminator) + 8 (count) + 32 (owner)
        space = 8 + 8 + 32
    )]
    pub counter: Account<'info, CounterAccount>,

    #[account(mut)]
    pub user: Signer<'info>, // será o owner e o payer

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, CounterAccount>,

    // quem chama paga a taxa; precisa ser signer e mut pra debitar lamports
    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Finalize<'info> {
    // close envia TODOS os lamports desta conta para `owner`
    #[account(mut, close = owner)]
    pub counter: Account<'info, CounterAccount>,

    // precisa ser o owner gravado na conta
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[account]
pub struct CounterAccount {
    pub count: i64,
    pub owner: Pubkey,
}

#[error_code]
pub enum CustomError {
    #[msg("Count must be at least 3 to finalize.")]
    CountNotHighEnough,
    #[msg("Only the owner can perform this action.")]
    NotOwner,
}
