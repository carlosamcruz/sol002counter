use anchor_lang::prelude::*;

declare_id!("E4MWtGRbfA6wUdYhZRfuN8ffX4dJ3cBrFhizY1muNmDi");

#[program]
pub mod counter_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, start_value: i64) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = start_value;
        //counter.finalized = false;
        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        //require!(!counter.finalized, CustomError::ContractFinalized);
        counter.count += 1;
        Ok(())
    }

    pub fn decrement(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        //require!(!counter.finalized, CustomError::ContractFinalized);
        counter.count -= 1;
        Ok(())
    }

    pub fn finalize(ctx: Context<Finalize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        require!(counter.count >= 3, CustomError::CountNotHighEnough);

        //counter.finalized = true;

        // Close the account, sending lamports back to user
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8 + 1)]
    pub counter: Account<'info, CounterAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, CounterAccount>,

    //pub user: Signer<'info>,
    
    ///CHECK: Anyone can call; no signer required
    pub user: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Finalize<'info> {
    #[account(mut, close = user)]
    pub counter: Account<'info, CounterAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

#[account]
pub struct CounterAccount {
    pub count: i64,
    //pub finalized: bool,
}

#[error_code]
pub enum CustomError {
    #[msg("Count must be at least 3 to finalize.")]
    CountNotHighEnough,

    //#[msg("Contract is already finalized.")]
    //ContractFinalized,
}